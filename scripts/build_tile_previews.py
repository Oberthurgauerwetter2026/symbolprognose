"""Erzeugt die statischen Kartengrundlagen der Startseiten-Kacheln.

Fotografiert die Originalkarten (/embed/*?clean=1) des laufenden Dev-Servers
einmal ohne ihre Live-Ebenen und schreibt Bild plus exakten Web-Mercator-
Ausschnitt nach public/previews/ bzw. src/data/preview-bases.json. Die Kacheln
legen darauf nur noch die aktuellen Daten – ohne eigene Karten-Instanz.

Neu ausführen, wenn sich Kartenstil, Ausschnitt oder Ortsbeschriftung ändern:
    python3 scripts/build_tile_previews.py
"""
import asyncio, io, json, math, re
from pathlib import Path
from PIL import Image
from playwright.async_api import async_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "previews"
ORIGIN = "http://localhost:8080"
R = 20037508.342789244
VIEWS = {
    "radar": ("/embed/radar?clean=1", 440, 304 + 44, True, True),
    "wind": ("/embed/wind?clean=1", 440, 304 + 44, True, True),
    "warn": ("/embed/warnungen?clean=1", 440, 304 + 44, True, True),
    "stations": ("/embed/stationen-extrem?stat=current&clean=1", 760, 330 + 44, True, False),
    "satellite": ("/embed/satellit-loop?clean=1", 440, 304 + 44, False, True),
}
HIDE_ALWAYS = ".leaflet-control-container{display:none!important}"
BASE_CSS = HIDE_ALWAYS + ".leaflet-marker-pane,.leaflet-overlay-pane canvas,.leaflet-pane canvas,.pointer-events-none.rounded-full{display:none!important}"
TOP_CSS = HIDE_ALWAYS + (
    ".leaflet-tile-pane,.leaflet-pane canvas{display:none!important}"
    "html,body,body *{background:transparent!important}"
    ".leaflet-overlay-pane path:not([fill='none']){display:none!important}"
)
MEASURE = """() => {
  const c = document.querySelector('.leaflet-container').getBoundingClientRect();
  const out = [];
  for (const img of document.querySelectorAll('.leaflet-tile-pane img')) {
    const r = img.getBoundingClientRect();
    if (r.width > 0) out.push({ src: img.src, x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height });
  }
  return { w: c.width, h: c.height, tiles: out };
}"""

def tile_box(src):
    """Web-Mercator-Ausschnitt (0..1, Ursprung oben links) einer Kachel-URL."""
    m = re.search(r"/3857/(\d+)/(\d+)/(\d+)\.png", src)
    if m:
        z, x, y = map(int, m.groups()); n = 2 ** z
        return x / n, y / n, (x + 1) / n, (y + 1) / n
    m = re.search(r"/tile/(\d+)/(\d+)/(\d+)", src)
    if m:
        z, y, x = map(int, m.groups()); n = 2 ** z
        return x / n, y / n, (x + 1) / n, (y + 1) / n
    m = re.search(r"[?&]bbox=([-\d.,eE]+)", src, re.I)
    if m:
        x0, y0, x1, y1 = map(float, m.group(1).split(","))
        return (x0 + R) / (2 * R), (R - y1) / (2 * R), (x1 + R) / (2 * R), (R - y0) / (2 * R)
    return None

async def shot(page, css, transparent):
    style = await page.add_style_tag(content=css)
    png = await page.locator(".leaflet-container").first.screenshot(omit_background=transparent)
    await style.evaluate("el => el.remove()")
    return Image.open(io.BytesIO(png))

async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    meta = {}
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for name, (path, w, h, base, top) in VIEWS.items():
            ctx = await browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2)
            page = await ctx.new_page()
            await page.goto(ORIGIN + path)
            await expect(page.locator(".leaflet-tile-loaded").first).to_be_visible(timeout=30000)
            await expect(page.locator(".leaflet-tile-pane img.leaflet-tile:not(.leaflet-tile-loaded)")).to_have_count(0, timeout=30000)
            if top:
                await expect(page.locator(".leaflet-marker-pane > *").first).to_be_attached(timeout=30000)
            m = await page.evaluate(MEASURE)
            ref = next((t, tile_box(t["src"])) for t in m["tiles"] if tile_box(t["src"]))
            t, (bx0, by0, bx1, by1) = ref
            sx, sy = (bx1 - bx0) / t["w"], (by1 - by0) / t["h"]
            entry = {
                "w": round(m["w"] * 2), "h": round(m["h"] * 2),
                "x0": bx0 - t["x"] * sx, "y0": by0 - t["y"] * sy,
                "x1": bx0 + (m["w"] - t["x"]) * sx, "y1": by0 + (m["h"] - t["y"]) * sy,
            }
            if base:
                (await shot(page, BASE_CSS, False)).convert("RGB").save(OUT / f"{name}-base.webp", quality=78, method=6)
                entry["base"] = f"/previews/{name}-base.webp"
            if top:
                (await shot(page, TOP_CSS, True)).save(OUT / f"{name}-top.webp", quality=80, method=6)
                entry["top"] = f"/previews/{name}-top.webp"
            if name == "satellite":
                wms = next(t["src"] for t in m["tiles"] if "bbox=" in t["src"].lower())
                entry["wmsLayer"] = re.search(r"[?&]layers=([^&]+)", wms, re.I).group(1)
                print("WMS sample:", wms)
            meta[name] = entry
            print(name, entry)
            await ctx.close()
        await browser.close()
    # Gemeindeflächen der Warnkarte als SVG-Pfade im Bildraster der Grundlage.
    warn = meta["warn"]
    def px(lon, lat):
        mx = (lon + 180) / 360
        my = (1 - math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)) / math.pi) / 2
        return ((mx - warn["x0"]) / (warn["x1"] - warn["x0"]) * warn["w"], (my - warn["y0"]) / (warn["y1"] - warn["y0"]) * warn["h"])
    regions, xs, ys = [], [], []
    for f in json.loads((ROOT / "src" / "data" / "region.json").read_text())["features"]:
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        d = ""
        for poly in polys:
            for ring in poly:
                pts, last = [], None
                for lon, lat in ring:
                    x, y = px(lon, lat); xs.append(x); ys.append(y)
                    cur = (round(x), round(y))
                    if cur != last: pts.append(cur); last = cur
                d += "M" + "L".join(f"{x},{y}" for x, y in pts) + "Z"
        regions.append({"name": f["properties"]["name"], "d": d})
    pad = 40
    warn["focus"] = [max(0, (min(xs) - pad) / warn["w"]), max(0, (min(ys) - pad) / warn["h"]), min(1, (max(xs) + pad) / warn["w"]), min(1, (max(ys) + pad) / warn["h"])]
    (ROOT / "src" / "data" / "preview-warn-regions.json").write_text(json.dumps(regions, separators=(",", ":")) + "\n")
    (ROOT / "src" / "data" / "preview-bases.json").write_text(json.dumps(meta, indent=1) + "\n")

asyncio.run(main())
