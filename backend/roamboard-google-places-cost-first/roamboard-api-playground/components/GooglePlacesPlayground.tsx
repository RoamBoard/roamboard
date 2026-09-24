/* eslint-disable @next/next/no-img-element */
"use client";

import { FormEvent, ReactNode, useMemo, useState } from "react";

type Tab = "search" | "nearby" | "autocomplete" | "details";
type JsonObject = Record<string, unknown>;
type ApiResult = { status: number; body: unknown; requestUrl: string };
type LoadedPhoto = { uri: string; authorName: string; authorUri: string };

const tabs: { id: Tab; label: string; note: string }[] = [
  { id: "search", label: "Text search", note: "Natural-language discovery" },
  { id: "nearby", label: "Nearby search", note: "Categories around a point" },
  { id: "autocomplete", label: "Autocomplete", note: "Search-as-you-type" },
  { id: "details", label: "Details & photos", note: "Inspect a selected place" },
];

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown) {
  return typeof value === "number" ? value : null;
}

function places(body: unknown): JsonObject[] {
  if (!isObject(body) || !Array.isArray(body.places)) return [];
  return body.places.filter(isObject);
}

function suggestions(body: unknown): JsonObject[] {
  if (!isObject(body) || !Array.isArray(body.suggestions)) return [];
  return body.suggestions.filter(isObject);
}

function displayName(place: JsonObject) {
  const value = isObject(place.displayName) ? place.displayName.text : place.displayName;
  return stringValue(value) || "Unnamed place";
}

function placeId(place: JsonObject) {
  return stringValue(place.id) || stringValue(place.placeId);
}

function typeLabel(place: JsonObject) {
  return stringValue(place.primaryType).replaceAll("_", " ") || "place";
}

function paramsFromForm(form: HTMLFormElement) {
  const params = new URLSearchParams();
  new FormData(form).forEach((value, key) => {
    const text = String(value).trim();
    if (text) params.append(key, text);
  });
  return params;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label>{label}{children}</label>;
}

function CostNote({ children, level = "pro" }: { children: ReactNode; level?: "pro" | "enterprise" }) {
  return <p className={`tier-note tier-${level}`}><strong>{level === "pro" ? "Cost-controlled" : "Explicit rich call"}</strong>{children}</p>;
}

async function readResponse(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (!raw.trim()) return { error: "The server returned an empty response.", status: response.status };
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return { error: "The server returned a non-JSON response.", status: response.status, preview: raw.slice(0, 500) };
  }
}

function RawResponse({ result }: { result: ApiResult | null }) {
  if (!result) return <p className="empty-state">Run this request to inspect its response.</p>;
  return (
    <details className="raw-response" open={result.status >= 400}>
      <summary>Raw JSON · HTTP {result.status}</summary>
      <div className="request-url">{result.requestUrl}</div>
      <pre>{JSON.stringify(result.body, null, 2)}</pre>
    </details>
  );
}

function PlaceCards({ items, onChoose }: { items: JsonObject[]; onChoose: (place: JsonObject) => void }) {
  return (
    <div className="result-grid">
      {items.map((place, index) => {
        const id = placeId(place);
        const rating = numberValue(place.rating);
        const count = numberValue(place.userRatingCount);
        return (
          <article className="place-result" key={id || index}>
            <div className="place-result-top"><span>{typeLabel(place)}</span>{rating !== null && <strong>★ {rating}</strong>}</div>
            <h3>{displayName(place)}</h3>
            <p>{stringValue(place.formattedAddress) || "No formatted address returned"}</p>
            {count !== null && <small className="muted">{count.toLocaleString()} Google ratings</small>}
            {id && <code>{id}</code>}
            {id && <div className="result-actions"><button type="button" onClick={() => onChoose(place)}>Inspect details</button>{typeof place.googleMapsUri === "string" && <a className="button secondary" href={place.googleMapsUri} target="_blank" rel="noreferrer">Google Maps</a>}</div>}
          </article>
        );
      })}
    </div>
  );
}

function predictionData(suggestion: JsonObject) {
  const prediction = isObject(suggestion.placePrediction) ? suggestion.placePrediction : null;
  const query = isObject(suggestion.queryPrediction) ? suggestion.queryPrediction : null;
  const text = prediction && isObject(prediction.text) ? stringValue(prediction.text.text) : query && isObject(query.text) ? stringValue(query.text.text) : "Suggestion";
  return { prediction, text, id: prediction ? stringValue(prediction.placeId) : "" };
}

export function GooglePlacesPlayground() {
  const [active, setActive] = useState<Tab>("search");
  const [loading, setLoading] = useState<Tab | null>(null);
  const [responses, setResponses] = useState<Partial<Record<Tab, ApiResult>>>({});
  const [selectedId, setSelectedId] = useState("");
  const [detailMode, setDetailMode] = useState("basic");
  const [sessionToken, setSessionToken] = useState("roamboard-demo-session-1");
  const [loadedPhotos, setLoadedPhotos] = useState<LoadedPhoto[]>([]);
  const [photoLoading, setPhotoLoading] = useState(false);

  const activeResult = responses[active] ?? null;
  const placeItems = useMemo(() => places(activeResult?.body), [activeResult]);
  const suggestionItems = useMemo(() => suggestions(activeResult?.body), [activeResult]);

  const run = async (event: FormEvent<HTMLFormElement>, tab: Tab, endpoint: (params: URLSearchParams) => string) => {
    event.preventDefault();
    setLoading(tab);
    const params = paramsFromForm(event.currentTarget);
    const requestUrl = endpoint(params);
    try {
      const response = await fetch(requestUrl);
      const body = await readResponse(response);
      setResponses((current) => ({ ...current, [tab]: { status: response.status, body, requestUrl } }));
      if (tab === "details") setLoadedPhotos([]);
    } catch (error) {
      setResponses((current) => ({ ...current, [tab]: { status: 0, body: { error: String(error) }, requestUrl } }));
    } finally {
      setLoading(null);
    }
  };

  const choosePlace = (place: JsonObject) => {
    const id = placeId(place);
    if (!id) return;
    setSelectedId(id);
    setActive("details");
  };

  const detailBody = responses.details?.body;
  const detailPhotos = isObject(detailBody) && Array.isArray(detailBody.photos)
    ? detailBody.photos.filter(isObject)
    : [];

  const loadPhotos = async () => {
    setPhotoLoading(true);
    try {
      const photos = await Promise.all(detailPhotos.slice(0, 3).map(async (photo) => {
        const name = stringValue(photo.name);
        const response = await fetch(`/api/google-places/photo?name=${encodeURIComponent(name)}&maxWidthPx=900`);
        const body = await readResponse(response);
        const authors = Array.isArray(photo.authorAttributions) ? photo.authorAttributions.filter(isObject) : [];
        return {
          uri: isObject(body) ? stringValue(body.photoUri) : "",
          authorName: authors.length > 0 ? stringValue(authors[0].displayName) : "",
          authorUri: authors.length > 0 ? stringValue(authors[0].uri) : "",
        };
      }));
      setLoadedPhotos(photos.filter((photo) => photo.uri));
    } finally {
      setPhotoLoading(false);
    }
  };

  return (
    <div className="fsq-shell">
      <aside className="fsq-nav" aria-label="Google Places experiments">
        {tabs.map((tab) => (
          <button className={active === tab.id ? "fsq-tab active" : "fsq-tab"} key={tab.id} onClick={() => setActive(tab.id)} type="button">
            <span>{tab.label}</span><small>{tab.note}</small>
          </button>
        ))}
      </aside>

      <section className="endpoint-card">
        {active === "search" && (
          <>
            <div className="endpoint-heading"><div><span className="method post">POST</span><code>/v1/places:searchText</code></div><h2>Natural-language place search</h2><p>Try intent-heavy searches such as “quiet design museums in Stockholm” or “vegetarian dinner near Gamla Stan”.</p></div>
            <form onSubmit={(event) => run(event, "search", (params) => `/api/google-places/search?${params}`)}>
              <div className="form-grid">
                <Field label="Search query"><input name="query" defaultValue="museums in Stockholm" required /></Field>
                <Field label="Response fields"><input value="Minimal Pro fields (locked)" disabled /></Field>
                <Field label="Latitude bias"><input name="latitude" defaultValue="59.3293" /></Field>
                <Field label="Longitude bias"><input name="longitude" defaultValue="18.0686" /></Field>
                <Field label="Bias radius (metres)"><input name="radius" type="number" defaultValue="10000" min="1" max="50000" /></Field>
                <Field label="Included type"><input name="includedType" placeholder="museum, restaurant, cafe…" /></Field>
                <Field label="Minimum rating"><select name="minRating" defaultValue=""><option value="">Any</option><option value="3.5">3.5+</option><option value="4">4.0+</option><option value="4.5">4.5+</option></select></Field>
                <Field label="Result count"><input name="pageSize" type="number" defaultValue="10" min="1" max="20" /></Field>
                <Field label="Rank preference"><select name="rankPreference" defaultValue="RELEVANCE"><option>RELEVANCE</option><option>DISTANCE</option></select></Field>
                <label className="check-field"><input name="openNow" type="checkbox" value="true" /> Open now only</label>
                <label className="check-field"><input name="strictType" type="checkbox" value="true" /> Strict type filtering</label>
              </div>
              <CostNote>Search is locked to ID, name, address, coordinates, primary type and Google Maps URL. Ratings, hours, reviews and photos cannot accidentally raise this request to Enterprise.</CostNote>
              <button type="submit" disabled={loading === "search"}>{loading === "search" ? "Searching…" : "Search Google Places"}</button>
            </form>
          </>
        )}

        {active === "nearby" && (
          <>
            <div className="endpoint-heading"><div><span className="method post">POST</span><code>/v1/places:searchNearby</code></div><h2>Discover places around a coordinate</h2><p>Useful for “what is near this hotel/photo/activity?” suggestions and category-based itinerary building.</p></div>
            <form onSubmit={(event) => run(event, "nearby", (params) => `/api/google-places/nearby?${params}`)}>
              <div className="form-grid">
                <Field label="Included types"><input name="includedTypes" defaultValue="restaurant" placeholder="restaurant,cafe,museum" required /></Field>
                <Field label="Response fields"><input value="Minimal Pro fields (locked)" disabled /></Field>
                <Field label="Latitude"><input name="latitude" defaultValue="59.3293" required /></Field>
                <Field label="Longitude"><input name="longitude" defaultValue="18.0686" required /></Field>
                <Field label="Radius (metres)"><input name="radius" type="number" defaultValue="3000" min="1" max="50000" /></Field>
                <Field label="Result count"><input name="maxResultCount" type="number" defaultValue="10" min="1" max="20" /></Field>
                <Field label="Rank preference"><select name="rankPreference" defaultValue="POPULARITY"><option>POPULARITY</option><option>DISTANCE</option></select></Field>
              </div>
              <CostNote>Nearby Search returns only the fields needed to render and select a place. Rich data is deferred until a user explicitly opens Details.</CostNote>
              <button type="submit" disabled={loading === "nearby"}>{loading === "nearby" ? "Searching…" : "Search nearby"}</button>
            </form>
          </>
        )}

        {active === "autocomplete" && (
          <>
            <div className="endpoint-heading"><div><span className="method post">POST</span><code>/v1/places:autocomplete</code></div><h2>Test destination and POI autocomplete</h2><p>Use one session token from the first keystroke through the selected Place Details request so Google groups the interaction correctly.</p></div>
            <form onSubmit={(event) => run(event, "autocomplete", (params) => `/api/google-places/autocomplete?${params}`)}>
              <div className="form-grid">
                <Field label="Partial input"><input name="input" defaultValue="Vasa mus" required /></Field>
                <Field label="Session token"><input name="sessionToken" value={sessionToken} onChange={(event) => setSessionToken(event.target.value)} /></Field>
                <Field label="Primary types"><input name="includedPrimaryTypes" placeholder="museum,restaurant" /></Field>
                <Field label="Language"><input name="languageCode" defaultValue="en" /></Field>
                <Field label="Region"><input name="regionCode" defaultValue="SE" /></Field>
                <Field label="Latitude bias"><input name="latitude" defaultValue="59.3293" /></Field>
                <Field label="Longitude bias"><input name="longitude" defaultValue="18.0686" /></Field>
                <Field label="Bias radius (metres)"><input name="radius" defaultValue="10000" type="number" /></Field>
              </div>
              <button type="submit" disabled={loading === "autocomplete"}>{loading === "autocomplete" ? "Loading…" : "Get suggestions"}</button>
            </form>
          </>
        )}

        {active === "details" && (
          <>
            <div className="endpoint-heading"><div><span className="method">GET</span><code>/v1/places/{'{placeId}'}</code></div><h2>Load details only when needed</h2><p>Basic mode stays at Pro. Rich mode is a deliberate Enterprise request for ratings, hours, contact data and photo references.</p></div>
            <form onSubmit={(event) => run(event, "details", (params) => {
              const id = params.get("id") || "";
              params.delete("id");
              return `/api/google-places/details/${encodeURIComponent(id)}?${params}`;
            })}>
              <div className="form-grid">
                <Field label="Google Place ID"><input name="id" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} placeholder="Choose a result or paste an ID" required /></Field>
                <Field label="Details mode"><select name="mode" value={detailMode} onChange={(event) => setDetailMode(event.target.value)}><option value="basic">Basic · Pro fields</option><option value="rich">Rich · Enterprise fields</option></select></Field>
                <Field label="Autocomplete session token"><input name="sessionToken" value={sessionToken} onChange={(event) => setSessionToken(event.target.value)} /></Field>
                <Field label="Language"><input name="languageCode" defaultValue="en" /></Field>
                <Field label="Region"><input name="regionCode" defaultValue="SE" /></Field>
              </div>
              <CostNote level={detailMode === "rich" ? "enterprise" : "pro"}>{detailMode === "rich" ? "Returns ratings, rating count, price, current hours, website, phone and photo references. Use after an explicit click." : "Returns identity, address, coordinates, type, status, time-zone offset and Google Maps URL."}</CostNote>
              <button type="submit" disabled={loading === "details"}>{loading === "details" ? "Loading…" : "Fetch place details"}</button>
            </form>
          </>
        )}

        {(active === "search" || active === "nearby") && placeItems.length > 0 && <PlaceCards items={placeItems} onChoose={choosePlace} />}

        {active === "autocomplete" && suggestionItems.length > 0 && (
          <div className="result-grid">
            {suggestionItems.map((suggestion, index) => {
              const prediction = predictionData(suggestion);
              return <article className="place-result" key={prediction.id || index}><div className="place-result-top"><span>{prediction.id ? "place prediction" : "query prediction"}</span></div><h3>{prediction.text}</h3>{prediction.id && <code>{prediction.id}</code>}{prediction.id && <button type="button" onClick={() => { setSelectedId(prediction.id); setActive("details"); }}>Use this place</button>}</article>;
            })}
          </div>
        )}

        {active === "details" && activeResult?.status === 200 && isObject(activeResult.body) && (
          <article className="detail-summary">
            <span className="eyebrow">Google place snapshot</span>
            <h3>{displayName(activeResult.body)}</h3>
            <p>{stringValue(activeResult.body.formattedAddress)}</p>
            <div className="metric-row">
              {typeof activeResult.body.rating === "number" && <span><strong>★ {activeResult.body.rating}</strong> rating</span>}
              {typeof activeResult.body.userRatingCount === "number" && <span><strong>{activeResult.body.userRatingCount}</strong> reviews</span>}
              {typeof activeResult.body.priceLevel === "string" && <span><strong>{activeResult.body.priceLevel.replace("PRICE_LEVEL_", "")}</strong> price</span>}
              {detailPhotos.length > 0 && <span><strong>{detailPhotos.length}</strong> photo references</span>}
            </div>
            {detailPhotos.length > 0 && <div className="photo-load-row"><button type="button" onClick={loadPhotos} disabled={photoLoading}>{photoLoading ? "Loading photos…" : `Load first ${Math.min(3, detailPhotos.length)} photos`}</button><small>Each image is a separate billable photo request, so the prototype limits a click to three.</small></div>}
          </article>
        )}

        {active === "details" && loadedPhotos.length > 0 && (
          <div className="fsq-photo-grid">{loadedPhotos.map((photo, index) => <figure key={photo.uri}><img src={photo.uri} alt={`Google place photo ${index + 1}`} /><figcaption>{photo.authorName ? <>Photo by {photo.authorUri ? <a href={photo.authorUri} target="_blank" rel="noreferrer">{photo.authorName}</a> : photo.authorName}</> : `Google Places photo ${index + 1}`}</figcaption></figure>)}</div>
        )}

        <RawResponse result={activeResult} />
      </section>
    </div>
  );
}
