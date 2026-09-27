"use client";

import mapboxgl, { GeoJSONSource, LngLatBoundsLike, Map as MapboxMap, Marker } from "mapbox-gl";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type JsonObject = Record<string, unknown>;
type Point = { id: string; longitude: number; latitude: number; label: string };
type Suggestion = { id: string; name: string; address: string; type: string };
type SearchFeature = {
  id: string;
  name: string;
  address: string;
  longitude: number;
  latitude: number;
  categories: string[];
  rating?: number;
  phone?: string;
  website?: string;
};
type RouteSummary = { distanceKm: number; durationMinutes: number; profile: string };
type ImportedPhotoLocation = { photo: string; longitude: number; latitude: number };

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

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function parseFeature(feature: JsonObject, index: number): SearchFeature | null {
  const point = coordinates(feature);
  if (!point) return null;
  const properties = isObject(feature.properties) ? feature.properties : {};
  const metadata = isObject(properties.metadata) ? properties.metadata : {};
  const categoryValue = properties.poi_category ?? properties.poi_category_ids;
  const categories = Array.isArray(categoryValue)
    ? categoryValue.filter((value): value is string => typeof value === "string")
    : [];
  const rating = Number(metadata.rating);

  return {
    id: String(feature.id ?? properties.mapbox_id ?? index),
    name: featureName(feature),
    address: featureAddress(feature),
    longitude: point[0],
    latitude: point[1],
    categories,
    rating: Number.isFinite(rating) ? rating : undefined,
    phone: optionalString(metadata.phone),
    website: optionalString(metadata.website),
  };
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
  const sessionTokenRef = useRef("");
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [query, setQuery] = useState("Gamla Stan, Stockholm");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchFeature[]>([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [stops, setStops] = useState<Point[]>([]);
  const [profile, setProfile] = useState("walking");
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [reverseResult, setReverseResult] = useState("Click the map or submit coordinates.");
  const [rawResponse, setRawResponse] = useState("Run an experiment to inspect its JSON response.");
  const [loading, setLoading] = useState<"search" | "reverse" | "route" | null>(null);
  const [importedPhoto, setImportedPhoto] = useState<ImportedPhotoLocation | null>(null);

  const sessionToken = () => {
    if (!sessionTokenRef.current) sessionTokenRef.current = crypto.randomUUID();
    return sessionTokenRef.current;
  };

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
        const params = new URLSearchParams(window.location.search);
        const importedLatitude = Number(params.get("latitude"));
        const importedLongitude = Number(params.get("longitude"));
        const hasImportedLocation = Number.isFinite(importedLatitude)
          && importedLatitude >= -90 && importedLatitude <= 90
          && Number.isFinite(importedLongitude)
          && importedLongitude >= -180 && importedLongitude <= 180;
        const imported = hasImportedLocation ? {
          photo: params.get("photo")?.trim() || "Cloudinary photo",
          latitude: importedLatitude,
          longitude: importedLongitude,
        } : null;
        setImportedPhoto(imported);
        const map = new mapboxgl.Map({
          container: mapContainer.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: imported ? [imported.longitude, imported.latitude] : [stockholm.longitude, stockholm.latitude],
          zoom: imported ? 14 : 11,
        });
        map.addControl(new mapboxgl.NavigationControl(), "top-right");
        map.on("load", () => {
          setMapReady(true);
          if (imported) void reverseGeocode(imported.longitude, imported.latitude, true);
        });
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

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSuggestionsLoading(true);
      const center = mapRef.current?.getCenter() ?? stockholm;
      const longitude = "lng" in center ? center.lng : center.longitude;
      const latitude = "lat" in center ? center.lat : center.latitude;
      const url = `/api/mapbox/suggest?query=${encodeURIComponent(trimmed)}&sessionToken=${encodeURIComponent(sessionToken())}&limit=6&longitude=${longitude}&latitude=${latitude}`;
      try {
        const response = await fetch(url, { signal: controller.signal });
        const body = await readJson(response);
        if (!response.ok || !isObject(body) || !Array.isArray(body.suggestions)) {
          setSuggestions([]);
          return;
        }
        setSuggestions(body.suggestions.filter(isObject).flatMap((item) => {
          const id = optionalString(item.mapbox_id);
          if (!id) return [];
          return [{
            id,
            name: String(item.name_preferred ?? item.name ?? "Unknown place"),
            address: String(item.full_address ?? item.place_formatted ?? ""),
            type: String(item.feature_type ?? "place"),
          }];
        }));
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setSuggestionsLoading(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const search = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading("search");
    const trimmedQuery = query.trim();
    const center = mapRef.current?.getCenter() ?? stockholm;
    const longitude = "lng" in center ? center.lng : center.longitude;
    const latitude = "lat" in center ? center.lat : center.latitude;
    const url = `/api/mapbox/search?query=${encodeURIComponent(trimmedQuery)}&limit=10&longitude=${longitude}&latitude=${latitude}`;

    try {
      const response = await fetch(url);
      const body = await readJson(response);
      setRawResponse(JSON.stringify({ status: response.status, url, body }, null, 2));
      if (!response.ok) throw new Error(isObject(body) ? String(body.error ?? "Search failed.") : "Search failed.");

      const parsed = featureList(body).flatMap((feature, index) => {
        const result = parseFeature(feature, index);
        return result ? [result] : [];
      });
      setSearchResults(parsed);
      setSuggestions([]);
      setActiveCategory("");
    } catch (error) {
      setSearchResults([]);
      setRawResponse(JSON.stringify({ error: String(error) }, null, 2));
    } finally {
      setLoading(null);
    }
  };

  const chooseSuggestion = async (suggestion: Suggestion) => {
    setLoading("search");
    const token = sessionToken();
    const url = `/api/mapbox/retrieve?id=${encodeURIComponent(suggestion.id)}&sessionToken=${encodeURIComponent(token)}`;
    try {
      const response = await fetch(url);
      const body = await readJson(response);
      setRawResponse(JSON.stringify({ status: response.status, url, body }, null, 2));
      if (!response.ok) throw new Error(isObject(body) ? String(body.error ?? "Place retrieval failed.") : "Place retrieval failed.");
      const result = featureList(body).map(parseFeature).find((item): item is SearchFeature => item !== null);
      if (!result) throw new Error("Mapbox returned no coordinates for this suggestion.");
      setQuery(result.name);
      setSuggestions([]);
      setSearchResults([result]);
      setActiveCategory("");
      chooseResult(result);
      sessionTokenRef.current = "";
    } catch (error) {
      setRawResponse(JSON.stringify({ error: String(error) }, null, 2));
    } finally {
      setLoading(null);
    }
  };

  const browseCategory = async (category: string) => {
    setLoading("search");
    setActiveCategory(category);
    setSuggestions([]);
    const center = mapRef.current?.getCenter() ?? stockholm;
    const longitude = "lng" in center ? center.lng : center.longitude;
    const latitude = "lat" in center ? center.lat : center.latitude;
    const url = `/api/mapbox/pois?category=${encodeURIComponent(category)}&limit=12&longitude=${longitude}&latitude=${latitude}`;
    try {
      const response = await fetch(url);
      const body = await readJson(response);
      setRawResponse(JSON.stringify({ status: response.status, url, body }, null, 2));
      if (!response.ok) throw new Error(isObject(body) ? String(body.error ?? "POI search failed.") : "POI search failed.");
      const parsed = featureList(body).flatMap((feature, index) => {
        const result = parseFeature(feature, index);
        return result ? [result] : [];
      });
      setSearchResults(parsed);
      if (parsed.length > 0) {
        const bounds = parsed.reduce(
          (current, result) => current.extend([result.longitude, result.latitude]),
          new mapboxgl.LngLatBounds([parsed[0].longitude, parsed[0].latitude], [parsed[0].longitude, parsed[0].latitude]),
        );
        mapRef.current?.fitBounds(bounds as LngLatBoundsLike, { padding: 80, maxZoom: 14 });
      }
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
        {importedPhoto && <article className="card">
          <div className="endpoint-heading compact">
            <span className="method experimental">PHOTO GPS</span>
            <h2>Cloudinary photo location</h2>
            <p><strong>{importedPhoto.photo}</strong> was sent from the Cloudinary prototype. Mapbox has centred the map, added a marker and reverse-geocoded the coordinates.</p>
          </div>
          <p className="mapbox-location-result">{importedPhoto.latitude.toFixed(6)}, {importedPhoto.longitude.toFixed(6)}</p>
          <p className="mapbox-location-result">{reverseResult}</p>
        </article>}
        <article className="card">
          <div className="endpoint-heading compact"><span className="method">GET</span><h2>1. Autocomplete + POI search</h2><p>Search addresses, destinations, restaurants, museums, cafés, hotels and attractions.</p></div>
          <form onSubmit={search}>
            <label className="mapbox-search-field">Place, address or POI
              <input name="query" value={query} onChange={(event) => {
                setQuery(event.target.value);
                if (event.target.value.trim().length < 2) setSuggestions([]);
              }} autoComplete="off" required />
              {(suggestionsLoading || suggestions.length > 0) && <div className="mapbox-suggestions" role="listbox">
                {suggestionsLoading && <span className="suggestion-loading">Finding suggestions…</span>}
                {suggestions.map((suggestion) => <button type="button" role="option" aria-selected="false" className="mapbox-suggestion" key={suggestion.id} onClick={() => void chooseSuggestion(suggestion)}>
                  <span><strong>{suggestion.name}</strong><small>{suggestion.address}</small></span><em>{suggestion.type}</em>
                </button>)}
              </div>}
            </label>
            <button type="submit" disabled={loading !== null}>{loading === "search" ? "Searching…" : "Search"}</button>
          </form>
          <div className="mapbox-search-results">
            {searchResults.map((result) => <button className="mapbox-result" type="button" key={result.id} onClick={() => chooseResult(result)}>
              <span className="mapbox-result-title"><strong>{result.name}</strong>{result.rating !== undefined && <b>★ {result.rating.toFixed(1)}</b>}</span>
              <span>{result.address}</span>
              {result.categories.length > 0 && <small>{result.categories.slice(0, 3).join(" · ")}</small>}
              <small>{result.latitude.toFixed(5)}, {result.longitude.toFixed(5)}</small>
            </button>)}
          </div>
        </article>

        <article className="card">
          <div className="endpoint-heading compact"><span className="method">GET</span><h2>2. Browse nearby POIs</h2><p>Search around the current map centre. Move the map first to test another neighbourhood.</p></div>
          <div className="poi-category-grid">
            {[
              ["coffee", "Cafés"],
              ["food_and_drink", "Food"],
              ["museum", "Museums"],
              ["hotel", "Hotels"],
              ["park", "Parks"],
              ["shopping", "Shopping"],
            ].map(([id, label]) => <button type="button" className={activeCategory === id ? "poi-chip active" : "poi-chip"} key={id} disabled={loading !== null} onClick={() => void browseCategory(id)}>{label}</button>)}
          </div>
          <small className="mapbox-helper">Results appear in the search card above. Select one to add it as a route stop.</small>
        </article>

        <article className="card">
          <div className="endpoint-heading compact"><span className="method">GET</span><h2>3. Reverse geocoding</h2><p>Turn EXIF GPS into a journal location. Submitting also adds a route stop.</p></div>
          <form className="form-row" onSubmit={reverseFromForm}>
            <label>Latitude<input name="latitude" type="number" step="any" defaultValue="59.3251" /></label>
            <label>Longitude<input name="longitude" type="number" step="any" defaultValue="18.0711" /></label>
            <button type="submit" disabled={loading !== null}>{loading === "reverse" ? "Looking up…" : "Reverse geocode"}</button>
          </form>
          <p className="mapbox-location-result">{reverseResult}</p>
        </article>

        <article className="card">
          <div className="endpoint-heading compact"><span className="method">GET</span><h2>4. Directions</h2><p>Add 2-10 stops by searching, submitting GPS, or clicking the map.</p></div>
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
