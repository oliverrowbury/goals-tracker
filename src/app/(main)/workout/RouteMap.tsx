"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Polyline, CircleMarker } from "leaflet";

type Point = { lat: number; lng: number };

// Plain Leaflet rather than react-leaflet — one polyline on one tile
// layer doesn't need a full React binding, and it sidesteps the default
// marker-icon path problem entirely (no markers, just circles drawn with
// L.circleMarker). Dynamically imported since Leaflet touches `window` on
// load and this always renders inside a client component anyway.
//
// CARTO's light "Positron" basemap instead of stock OpenStreetMap tiles —
// much less visual noise (thin grey roads, minimal labels) so the route
// itself reads clearly instead of competing with a busy street map.
const TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION = "&copy; OpenStreetMap contributors &copy; CARTO";

// `live: true` (an in-progress session) keeps a fixed zoom and smoothly
// pans to follow the latest fix, like Strava's live view — refitting the
// bounds on every single update looks jumpy as the camera constantly
// re-centers and re-zooms. `live: false` (history) instead fits the whole
// route once, since there's nothing left to follow.
export function RouteMap({ points, height = 220, live = false }: { points: Point[]; height?: number; live?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const haloRef = useRef<Polyline | null>(null);
  const lineRef = useRef<Polyline | null>(null);
  const startRef = useRef<CircleMarker | null>(null);
  const currentRef = useRef<CircleMarker | null>(null);
  const hasFitRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || points.length < 2) return;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          zoomControl: false,
          attributionControl: true,
          scrollWheelZoom: false,
          dragging: !live,
          touchZoom: !live,
          doubleClickZoom: !live,
          boxZoom: !live,
        });
        L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 20 }).addTo(mapRef.current);
      }
      const map = mapRef.current;

      const latlngs = points.map((p): [number, number] => [p.lat, p.lng]);
      const start = latlngs[0];
      const end = latlngs[latlngs.length - 1];

      // A pale, wider line underneath the colored one gives the route a
      // halo so it stays legible over roads/parks of any tile color.
      haloRef.current?.remove();
      lineRef.current?.remove();
      haloRef.current = L.polyline(latlngs, {
        color: "#ffffff",
        weight: 7,
        opacity: 0.85,
        lineJoin: "round",
        lineCap: "round",
      }).addTo(map);
      lineRef.current = L.polyline(latlngs, {
        color: "#b8474a",
        weight: 4,
        lineJoin: "round",
        lineCap: "round",
      }).addTo(map);

      if (!startRef.current) {
        startRef.current = L.circleMarker(start, {
          radius: 6,
          color: "#ffffff",
          weight: 2,
          fillColor: "#5f9e6f",
          fillOpacity: 1,
        }).addTo(map);
      }

      if (live) {
        currentRef.current?.remove();
        currentRef.current = L.circleMarker(end, {
          radius: 7,
          color: "#ffffff",
          weight: 2,
          fillColor: "#b8474a",
          fillOpacity: 1,
        }).addTo(map);

        if (!hasFitRef.current) {
          map.setView(end, 17);
          hasFitRef.current = true;
        } else {
          map.panTo(end, { animate: true, duration: 0.4 });
        }
      } else if (!hasFitRef.current) {
        currentRef.current?.remove();
        currentRef.current = L.circleMarker(end, {
          radius: 6,
          color: "#ffffff",
          weight: 2,
          fillColor: "#b8474a",
          fillOpacity: 1,
        }).addTo(map);
        map.fitBounds(lineRef.current.getBounds(), { padding: [20, 20] });
        hasFitRef.current = true;
      }

      map.invalidateSize();
    });

    return () => {
      cancelled = true;
    };
  }, [points, live]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      hasFitRef.current = false;
    };
  }, []);

  if (points.length < 2) return null;

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="w-full overflow-hidden rounded-xl border border-line bg-paper"
    />
  );
}
