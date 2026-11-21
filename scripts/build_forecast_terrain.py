"""Rebuild the forecast DEM from AWS Terrain Tiles (Terrarium, zoom 9).

Source: https://registry.opendata.aws/terrain-tiles/ (Mapzen/AWS public data).
Actual terrain samples, not an enlarged copy of the measurement DEM.
North-up, endpoint-aligned WGS84 bbox matches ingest_openmeteo._bbox().
Raw tiles are cached under /tmp, never in the repository.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import io
import numpy as np
import requests
from PIL import Image

WIDTH, HEIGHT, ZOOM = 840, 400, 9
BBOX = (7.4, 46.6, 11.6, 48.6)


def build():
    west, south, east, north = BBOX
    lon = np.linspace(west, east, WIDTH)
    lat = np.linspace(north, south, HEIGHT)
    world = 256 * 2 ** ZOOM
    x = (lon + 180) / 360 * world - 0.5
    y = (1 - np.arcsinh(np.tan(np.deg2rad(lat))) / np.pi) / 2 * world - 0.5
    x0, y0 = int(np.floor(x.min() / 256)), int(np.floor(y.min() / 256))
    x1, y1 = int(np.floor((x.max() + 1) / 256)), int(np.floor((y.max() + 1) / 256))
    cache = Path('/tmp/forecast-terrain-tiles')
    cache.mkdir(exist_ok=True)

    def tile(pair):
        tx, ty = pair
        path = cache / f'{ZOOM}-{tx}-{ty}.png'
        if not path.exists():
            response = requests.get(
                f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{ZOOM}/{tx}/{ty}.png',
                timeout=60)
            response.raise_for_status()
            path.write_bytes(response.content)
        rgb = np.asarray(Image.open(io.BytesIO(path.read_bytes())).convert('RGB'), dtype=np.float32)
        if rgb.shape != (256, 256, 3):
            raise ValueError(f'Invalid terrain tile {pair}')
        return tx, ty, rgb[..., 0] * 256 + rgb[..., 1] + rgb[..., 2] / 256 - 32768

    mosaic = np.empty(((y1-y0+1)*256, (x1-x0+1)*256), np.float32)
    pairs = [(tx, ty) for ty in range(y0, y1+1) for tx in range(x0, x1+1)]
    with ThreadPoolExecutor(max_workers=6) as pool:
        for tx, ty, data in pool.map(tile, pairs):
            mosaic[(ty-y0)*256:(ty-y0+1)*256, (tx-x0)*256:(tx-x0+1)*256] = data
    px, py = x - x0*256, y - y0*256
    ix, iy = np.floor(px).astype(int), np.floor(py).astype(int)
    dx, dy = (px-ix)[None, :], (py-iy)[:, None]
    dem = ((mosaic[iy[:, None], ix] * (1-dx) + mosaic[iy[:, None], ix+1] * dx) * (1-dy)
           + (mosaic[iy[:, None]+1, ix] * (1-dx) + mosaic[iy[:, None]+1, ix+1] * dx) * dy)
    if not np.isfinite(dem).all() or dem.min() < 0 or dem.max() > 5000:
        raise ValueError('Invalid terrain elevations; refusing to publish DEM')
    destination = Path(__file__).with_name('terrain_elev_840x400.npy')
    np.save(destination, dem.astype(np.float32))
    print(f'{destination.name}: {dem.shape}, {len(pairs)} source tiles, {dem.min():.0f}–{dem.max():.0f} m')


if __name__ == '__main__':
    build()