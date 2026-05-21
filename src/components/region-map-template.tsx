import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  MapContainer,
  GeoJSON,
  TileLayer,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Feature, FeatureCollection, Polygon } from "geojson";

/**
 * SwisstopoRegionMap — wiederverwendbare Karten-Basis
 *
 * Swisstopo "leichte Basiskarte" + swissALTI3D Reliefschattierung,
 * Region als hervorgehobenes Polygon, Aussenbereich grau maskiert,
 * optional See als blaues Overlay. Marker/Layers werden via children
 * eingehängt.
 *
 * Beispiel:
 *   <SwisstopoRegionMap region={REGION} lake={LAKE}>
 *     <Marker position={[47.5, 9.3]} />
 *   </SwisstopoRegionMap>
 */
export type SwisstopoRegionMapProps = {
  region: FeatureCollection;
  lake?: FeatureCollection;
  /** Hex-Farbe für Region-Outline (default brand-blue). */
  regionStrokeColor?: string;
  /** Hex-Farbe für Region-Füllung. */
  regionFillColor?: string;
  /** 0–1 für Region-Füllung. */
  regionFillOpacity?: number;
  /** 0–1 für graue Aussen-Maske. */
  outsideOpacity?: number;
  /** 0–1 für Relief-Layer. */
  reliefOpacity?: number;
  /** Default-Zoom. */
  zoom?: number;
  /** Karten-Höhe (CSS). */
  height?: string | number;
  /** zusätzliche Klasse auf dem Wrapper. */
  className?: string;
  /** Marker / weitere Layer als react-leaflet Children. */
  children?: ReactNode;
};

export function SwisstopoRegionMap({
  region,
  lake,
  regionStrokeColor = "#2561a1",
  regionFillColor = "#7ebd5a",
  regionFillOpacity = 0.55,
  outsideOpacity = 0.6,
  reliefOpacity = 0.65,
  zoom = 11,
  height = 600,
  className,
  children,
}: SwisstopoRegionMapProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const outsideMask = useMemo<FeatureCollection>(() => {
    const holes: number[][][] = [];
    const collect = (fc: FeatureCollection) => {
      for (const f of fc.features) {
        const g = f.geometry;
        if (!g) continue;
        if (g.type === "Polygon") {
          if (g.coordinates[0]) holes.push(g.coordinates[0]);
        } else if (g.type === "MultiPolygon") {
          for (const poly of g.coordinates) {
            if (poly[0]) holes.push(poly[0]);
          }
        }
      }
    };
    collect(region);
    if (lake) collect(lake);
    const world: number[][] = [
      [-180, -85],
      [180, -85],
      [180, 85],
      [-180, 85],
      [-180, -85],
    ];
    const feat: Feature<Polygon> = {
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [world, ...holes] },
    };
    return { type: "FeatureCollection", features: [feat] };
  }, [region, lake]);

  const { center, maxBounds } = useMemo(() => {
    const layer = L.geoJSON(region);
    const b = layer.getBounds();
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    const extended = L.latLngBounds(
      [sw.lat - 0.001, sw.lng - 0.001],
      [ne.lat + 0.001, ne.lng + 0.001],
    );
    const c = b.getCenter();
    return {
      center: [c.lat, c.lng] as [number, number],
      maxBounds: extended.pad(0.3),
    };
  }, [region]);

  if (!mounted) {
    return (
      <div
        className={className}
        style={{
          height,
          width: "100%",
          background: "#e8edef",
          borderRadius: 16,
        }}
      />
    );
  }

  return (
    <div
      className={className}
      style={{
        position: "relative",
        height,
        width: "100%",
        overflow: "hidden",
        borderRadius: 16,
      }}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        maxBounds={maxBounds}
        maxBoundsViscosity={1.0}
        minZoom={9}
        maxZoom={17}
        scrollWheelZoom
        zoomControl={false}
        attributionControl
        style={{ height: "100%", width: "100%", background: "#e8edef" }}
      >
        <TileLayer
          url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.leichte-basiskarte/default/current/3857/{z}/{x}/{y}.png"
          maxZoom={18}
          attribution='© <a href="https://www.swisstopo.admin.ch/">swisstopo</a>, © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <TileLayer
          url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissalti3d-reliefschattierung/default/current/3857/{z}/{x}/{y}.png"
          maxZoom={18}
          opacity={reliefOpacity}
        />
        <GeoJSON
          data={outsideMask}
          style={() => ({
            stroke: false,
            fillColor: "#5a6670",
            fillOpacity: outsideOpacity,
          })}
          interactive={false}
        />
        {lake && (
          <GeoJSON
            data={lake}
            style={() => ({
              color: "#6bb6d6",
              weight: 0.6,
              fillColor: "#7ec8e3",
              fillOpacity: 0.9,
            })}
            interactive={false}
          />
        )}
        <GeoJSON
          data={region}
          style={() => ({
            color: regionStrokeColor,
            weight: 2,
            opacity: 0.9,
            fillColor: regionFillColor,
            fillOpacity: regionFillOpacity,
          })}
          interactive={false}
        />
        {children}
        <ZoomControl position="topright" />
      </MapContainer>
    </div>
  );
}
