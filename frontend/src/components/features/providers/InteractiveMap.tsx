"use client";

import mapboxgl, { type Map as MapboxMap, type Marker } from "mapbox-gl";
import { useEffect, useRef, useState } from "react";

export type MapPoint = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

type Props = {
  token?: string;
  points: MapPoint[];
  routeGeometry: Array<[number, number]>;
  onMapClick: (latitude: number, longitude: number) => void;
};

const routeSource = "roamboard-provider-route";

export default function InteractiveMap({ token, points, routeGeometry, onMapClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    if (!token || !containerRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [18.0686, 59.3293],
      zoom: 11,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.on("load", () => {
      map.addSource(routeSource, { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } } });
      map.addLayer({ id: routeSource, type: "line", source: routeSource, paint: { "line-color": "#161616", "line-width": 4, "line-opacity": 0.8 } });
    });
    map.on("click", (event) => onMapClick(event.lngLat.lat, event.lngLat.lng));
    map.on("error", (event) => setMapError(event.error?.message ?? "The Mapbox map could not load."));
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [token, onMapClick]);

  useEffect(() => {
    markersRef.current.forEach((marker) => marker.remove());
    const map = mapRef.current;
    if (!map) return;
    markersRef.current = points.map((point, index) => {
      const element = document.createElement("div");
      element.className = "provider-map-pin";
      element.innerHTML = `<span>${index + 1}</span>`;
      element.title = point.label;
      return new mapboxgl.Marker({ element })
        .setLngLat([point.longitude, point.latitude])
        .addTo(map);
    });
  }, [points]);

  useEffect(() => {
    const source = mapRef.current?.getSource(routeSource) as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: routeGeometry },
    });
  }, [routeGeometry]);

  if (!token) return <div className="grid aspect-video place-items-center border border-line bg-faint px-6 text-center text-14 text-graphite">Add a public Mapbox `pk.` token to enable the interactive map.</div>;
  return <div className="relative"><div ref={containerRef} className="h-96 w-full sm:h-120" aria-label="Interactive Mapbox map" />{mapError ? <p className="absolute bottom-3 left-3 right-3 bg-white/95 p-3 text-12 text-foreground" role="alert">{mapError}</p> : null}</div>;
}
