"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Polyline } from "leaflet";

type Point = { lat: number; lng: number };

// Plain Leaflet rather than react-leaflet — one polyline on one tile
// layer doesn't need a full React binding, and it sidesteps the default
// marker-icon path problem entirely (no markers, just circles drawn with
// L.circleMarker). Dynamically imported since Leaflet touches `window` on
// load and this always renders inside a client component anyway.
export function RouteMap({ points, height = 220 }: { points: Point[]; height?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const lineRef = useRef<Polyline | null>(null);

  useEffect(() => {
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || points.length < 2) return;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(mapRef.current);
      }

      const latlngs = points.map((p): [number, number] => [p.lat, p.lng]);
      lineRef.current?.remove();
      lineRef.current = L.polyline(latlngs, { color: "#b8474a", weight: 4 }).addTo(mapRef.current);

      const start = latlngs[0];
      const end = latlngs[latlngs.length - 1];
      L.circleMarker(start, { radius: 5, color: "#5f9e6f", fillColor: "#5f9e6f", fillOpacity: 1 }).addTo(mapRef.current);
      L.circleMarker(end, { radius: 5, color: "#b8474a", fillColor: "#b8474a", fillOpacity: 1 }).addTo(mapRef.current);

      mapRef.current.fitBounds(lineRef.current.getBounds(), { padding: [20, 20] });
      // A stale size (e.g. a container that was hidden until just now)
      // leaves the map cropped until the next manual interaction.
      mapRef.current.invalidateSize();
    });

    return () => {
      cancelled = true;
    };
  }, [points]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  if (points.length < 2) return null;

  return <div ref={containerRef} style={{ height }} className="w-full overflow-hidden rounded-xl border border-line" />;
}
