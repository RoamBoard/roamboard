"use client";

import mapboxgl, { GeoJSONSource, LngLatBoundsLike, Map as MapboxMap, Marker } from "mapbox-gl";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type JsonObject = Record<string, unknown>;
type Point = { id: string; longitude: number; latitude: number; label: string };
type SearchFeature = { id: string; name: string; address: string; longitude: number; latitude: number };
type RouteSummary = { distanceKm: number; durationMinutes: number; profile: string };

const stockholm = { longitude: 18.0686, latitude: 59.3293 };
const routeSourceId = "roamboard-route";

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function featureList(body: unknown): JsonObject[] {
  return isObject(body) && Array.isArray(body.features) ? body.features.filter(isObject) : [];
}

function coordinates(feature: JsonObject): [number, number] | null {
  const geometry = isObject(feature.geometry) ? feature.geometry : null;
  const values = geometry && Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
  const longitude = Number(values[0]);
  const latitude = Number(values[1]);
  return Number.isFinite(longitude) && Number.isFinite(latitude) ? [longitude, latitude] : null;
}

function featureName(feature: JsonObject) {
  const properties = isObject(feature.properties) ? feature.properties : {};
  return String(properties.name_preferred ?? properties.name ?? properties.full_address ?? "Unknown place");
}

function featureAddress(feature: JsonObject) {
  const properties = isObject(feature.properties) ? feature.properties : {};
  return String(properties.full_address ?? properties.place_formatted ?? featureName(feature));
}

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return text ? (JSON.parse(text) as unknown) : null;
  } catch {
    return { error: "The server returned non-JSON data.", preview: text.slice(0, 300) };
  }
}

export function MapboxPlayground() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [searchResults, setSearchResults] = useState<SearchFeature[]>([]);
  const [stops, setStops] = useState<Point[]>([]);
  const [profile, setProfile] = useState("walking");
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [reverseResult, setReverseResult] = useState("Click the map or submit coordinates.");
  const [rawResponse, setRawResponse] = useState("Run an experiment to inspect its JSON response.");
  const [loading, setLoading] = useState<"search" | "reverse" | "route" | null>(null);

  const reverseGeocode = useCallback(async (longitude: number, latitude: number, addStop: boolean) => {
    setLoading("reverse");
    const url = `/api/mapbox/reverse?longitude=${longitude}&latitude=${latitude}`;
    try {
      const response = await fetch(url);
      const body = await readJson(response);
      setRawResponse(JSON.stringify({ status: response.status, url, body }, null, 2));
      if (!response.ok) throw new Error(isObject(body) ? String(body.error ?? "Reverse geocoding failed.") : "Reverse geocoding failed.");

      const first = featureList(body)[0];
      const label = first ? featureAddress(first) : `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      setReverseResult(label);
      if (addStop) {
        setStops((current) => current.length >= 10 ? current : [...current, {
          id: crypto.randomUUID(), longitude, latitude, label,
        }]);
      }
    } catch (error) {
      setReverseResult(String(error));
    } finally {
      setLoading(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initialise = async () => {
      try {
        const response = await fetch("/api/mapbox/config");
        const body = await readJson(response);
        if (!response.ok || !isObject(body) || typeof body.token !== "string") {
          throw new Error(isObject(body) ? String(body.error ?? "Mapbox token unavailable.") : "Mapbox token unavailable.");
        }
        if (cancelled || !mapContainer.current) return;

        mapboxgl.accessToken = body.token;
        const map = new mapboxgl.Map({
          container: mapContainer.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: [stockholm.longitude, stockholm.latitude],
          zoom: 11,
        });
        map.addControl(new mapboxgl.NavigationControl(), "top-right");
        map.on("load", () => setMapReady(true));
        map.on("click", (event) => void reverseGeocode(event.lngLat.lng, event.lngLat.lat, true));
        map.on("error", (event) => setMapError(event.error?.message ?? "The map could not load."));
        mapRef.current = map;
      } catch (error) {
        setMapError(String(error));
      }
    };

    void initialise();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [reverseGeocode]);

  useEffect(() => {
    markersRef.current.forEach((marker) => marker.remove());
    if (!mapRef.current) return;
    markersRef.current = stops.map((stop, index) => {
      const element = document.createElement("div");
      element.className = "mapbox-stop-marker";
      element.textContent = String(index + 1);
      return new mapboxgl.Marker({ element }).setLngLat([stop.longitude, stop.latitude]).addTo(mapRef.current!);
    });
  }, [stops, mapReady]);

  const search = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading("search");
    const form = new FormData(event.currentTarget);
    const query = String(form.get("query") ?? "").trim();
    const url = `/api/mapbox/search?query=${encodeURIComponent(query)}&limit=6&longitude=${stockholm.longitude}&latitude=${stockholm.latitude}`;

    try {
      const response = await fetch(url);
      const body = await readJson(response);
      setRawResponse(JSON.stringify({ status: response.status, url, body }, null, 2));
      if (!response.ok) throw new Error(isObject(body) ? String(body.error ?? "Search failed.") : "Search failed.");

      const parsed = featureList(body).flatMap((feature, index) => {
        const point = coordinates(feature);
        return point ? [{
          id: String(feature.id ?? index), name: featureName(feature), address: featureAddress(feature),
          longitude: point[0], latitude: point[1],
        }] : [];
      });
      setSearchResults(parsed);
    } catch (error) {
      setSearchResults([]);
      setRawResponse(JSON.stringify({ error: String(error) }, null, 2));
    } finally {
      setLoading(null);
    }
  };

  const chooseResult = (result: SearchFeature) => {
    mapRef.current?.flyTo({ center: [result.longitude, result.latitude], zoom: 14 });
    setStops((current) => current.length >= 10 ? current : [...current, {
      id: crypto.randomUUID(), longitude: result.longitude, latitude: result.latitude, label: result.address,
    }]);
  };

  const reverseFromForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void reverseGeocode(Number(form.get("longitude")), Number(form.get("latitude")), true);
  };

  const drawRoute = (geometry: JsonObject) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const data = { type: "Feature", properties: {}, geometry } as Parameters<GeoJSONSource["setData"]>[0];
    const existing = map.getSource(routeSourceId) as GeoJSONSource | undefined;
    if (existing) existing.setData(data);
    else {
      map.addSource(routeSourceId, { type: "geojson", data });
      map.addLayer({
        id: routeSourceId,
        type: "line",
        source: routeSourceId,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#2563eb", "line-width": 6, "line-opacity": 0.85 },
      });
    }
  };

  const calculateRoute = async () => {
    if (stops.length < 2) return;
    setLoading("route");
    const pointString = stops.map((stop) => `${stop.longitude},${stop.latitude}`).join(";");
    const url = `/api/mapbox/directions?profile=${profile}&coordinates=${encodeURIComponent(pointString)}`;
    try {
      const response = await fetch(url);
      const body = await readJson(response);
      setRawResponse(JSON.stringify({ status: response.status, url, body }, null, 2));
      if (!response.ok || !isObject(body)) throw new Error(isObject(body) ? String(body.error ?? "Route failed.") : "Route failed.");
      const route = Array.isArray(body.routes) && isObject(body.routes[0]) ? body.routes[0] : null;
      if (!route || !isObject(route.geometry)) throw new Error("Mapbox returned no route for these stops.");

      setRouteSummary({
        distanceKm: Number(route.distance) / 1000,
        durationMinutes: Number(route.duration) / 60,
        profile,
      });
      drawRoute(route.geometry);
      const bounds = stops.reduce(
        (current, stop) => current.extend([stop.longitude, stop.latitude]),
        new mapboxgl.LngLatBounds([stops[0].longitude, stops[0].latitude], [stops[0].longitude, stops[0].latitude]),
      );
      mapRef.current?.fitBounds(bounds as LngLatBoundsLike, { padding: 80, maxZoom: 14 });
    } catch (error) {
      setRouteSummary(null);
      setRawResponse(JSON.stringify({ error: String(error) }, null, 2));
    } finally {
      setLoading(null);
    }
  };

  const clearStops = () => {
    setStops([]);
    setRouteSummary(null);
    const map = mapRef.current;
    if (map?.getLayer(routeSourceId)) map.removeLayer(routeSourceId);
    if (map?.getSource(routeSourceId)) map.removeSource(routeSourceId);
  };

  return (
    <div className="mapbox-playground">
      <section className="mapbox-controls">
        <article className="card">
          <div className="endpoint-heading compact"><span className="method">GET</span><h2>1. Forward geocoding</h2><p>Search cities, neighbourhoods and addresses, then add a result as a route stop.</p></div>
          <form onSubmit={search}>
            <label>Place or address<input name="query" defaultValue="Gamla Stan, Stockholm" required /></label>
            <button type="submit" disabled={loading !== null}>{loading === "search" ? "Searching…" : "Search destinations"}</button>
          </form>
          <div className="mapbox-search-results">
            {searchResults.map((result) => <button className="mapbox-result" type="button" key={result.id} onClick={() => chooseResult(result)}>
              <strong>{result.name}</strong><span>{result.address}</span><small>{result.latitude.toFixed(5)}, {result.longitude.toFixed(5)}</small>
            </button>)}
          </div>
        </article>

        <article className="card">
          <div className="endpoint-heading compact"><span className="method">GET</span><h2>2. Reverse geocoding</h2><p>Turn EXIF GPS into a journal location. Submitting also adds a route stop.</p></div>
          <form className="form-row" onSubmit={reverseFromForm}>
            <label>Latitude<input name="latitude" type="number" step="any" defaultValue="59.3251" /></label>
            <label>Longitude<input name="longitude" type="number" step="any" defaultValue="18.0711" /></label>
            <button type="submit" disabled={loading !== null}>{loading === "reverse" ? "Looking up…" : "Reverse geocode"}</button>
          </form>
          <p className="mapbox-location-result">{reverseResult}</p>
        </article>

        <article className="card">
          <div className="endpoint-heading compact"><span className="method">GET</span><h2>3. Directions</h2><p>Add 2-10 stops by searching, submitting GPS, or clicking the map.</p></div>
          <div className="route-actions">
            <label>Travel profile<select value={profile} onChange={(event) => setProfile(event.target.value)}><option value="walking">Walking</option><option value="cycling">Cycling</option><option value="driving">Driving</option></select></label>
            <button type="button" disabled={stops.length < 2 || loading !== null} onClick={() => void calculateRoute()}>{loading === "route" ? "Routing…" : "Calculate route"}</button>
            <button type="button" className="button secondary" onClick={clearStops}>Clear</button>
          </div>
          <ol className="route-stops">
            {stops.map((stop, index) => <li key={stop.id}><span>{index + 1}</span><div><strong>{stop.label}</strong><small>{stop.latitude.toFixed(5)}, {stop.longitude.toFixed(5)}</small></div><button type="button" aria-label={`Remove stop ${index + 1}`} onClick={() => setStops((current) => current.filter((item) => item.id !== stop.id))}>×</button></li>)}
          </ol>
          {routeSummary && <div className="route-summary"><strong>{routeSummary.distanceKm.toFixed(1)} km</strong><span>{Math.round(routeSummary.durationMinutes)} min</span><span>{routeSummary.profile}</span></div>}
        </article>
      </section>

      <section className="mapbox-map-panel">
        <div className="mapbox-map-header"><div><strong>Interactive Mapbox GL map</strong><span>Click anywhere to reverse-geocode and add a stop.</span></div><span className={mapReady ? "map-status ready" : "map-status"}>{mapReady ? "Ready" : "Loading"}</span></div>
        <div ref={mapContainer} className="mapbox-map" />
        {mapError && <p className="mapbox-error">{mapError}</p>}
      </section>

      <details className="raw-response mapbox-raw"><summary>Raw JSON and local request</summary><pre>{rawResponse}</pre></details>
    </div>
  );
}
