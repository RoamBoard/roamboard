"use client";

import { useCallback, useState } from "react";
import InteractiveMap, { type MapPoint } from "./InteractiveMap";
import { reverseMapboxProvider, routeMapboxProvider, searchMapboxProvider, type ProviderPlace, type ProviderRoute } from "@/lib/providers";

type Props = {
  token?: string;
  initialPoint: { latitude: number; longitude: number; label: string } | null;
};

type RouteProfile = ProviderRoute["profile"];

export default function MapboxPanel({ token, initialPoint }: Props) {
  const [places, setPlaces] = useState<ProviderPlace[]>([]);
  const [saved, setSaved] = useState<MapPoint[]>(initialPoint ? [{ id: "photo-handoff", ...initialPoint }] : []);
  const [route, setRoute] = useState<ProviderRoute | null>(null);
  const [profile, setProfile] = useState<RouteProfile>("walking");
  const [search, setSearch] = useState("Gamla Stan, Stockholm");
  const [loading, setLoading] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [error, setError] = useState("");
  const [reverseError, setReverseError] = useState("");

  const addPoint = useCallback((point: MapPoint) => {
    setSaved((current) => current.some((item) => item.id === point.id) ? current : [...current, point]);
    setRoute(null);
  }, []);

  const handleMapClick = useCallback(async (latitude: number, longitude: number) => {
    setReverseError("");
    try {
      const result = await reverseMapboxProvider(String(latitude), String(longitude));
      addPoint({ id: `map-${latitude}-${longitude}`, label: result.address, latitude, longitude });
    } catch (caught) {
      setReverseError(caught instanceof Error ? caught.message : "Could not resolve that map location.");
    }
  }, [addPoint]);

  async function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (search.trim().length < 2) return;
    setLoading(true);
    setError("");
    try {
      setPlaces(await searchMapboxProvider(search.trim()));
    } catch (caught) {
      setPlaces([]);
      setError(caught instanceof Error ? caught.message : "Mapbox search failed.");
    } finally {
      setLoading(false);
    }
  }

  async function buildRoute() {
    setRouteLoading(true);
    setError("");
    try {
      setRoute(await routeMapboxProvider(saved, profile));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Mapbox routing failed.");
    } finally {
      setRouteLoading(false);
    }
  }

  if (!token) return <div className="mt-8 border border-line p-6"><h2 className="font-display text-24 font-bold text-foreground">Mapbox</h2><p className="mt-5 text-14 leading-6 text-graphite">Add a valid public `pk.` Mapbox token to enable the interactive map. The server-side token is configured, but the browser map intentionally only accepts a public token.</p></div>;

  return <div className="mt-8 border border-line p-6"><div className="flex flex-wrap items-baseline justify-between gap-3"><h2 className="font-display text-24 font-bold text-foreground">Interactive Mapbox map</h2><span className="text-10 font-bold uppercase tracking-label text-graphite">configured</span></div><p className="mt-3 text-14 leading-6 text-graphite">Search with a place, POI, address, or area. Save results as numbered pinpoints, click the map to add a location, then route between two or more saved stops.</p><form className="mt-6 flex flex-wrap items-end gap-4" onSubmit={(event) => void submitSearch(event)}><label className="min-w-56 flex-1 text-12 text-graphite">Smart place search<input className="mt-2 w-full border-b border-line bg-transparent py-3 text-15 text-foreground outline-none focus:border-foreground" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cafe, museum, address, or destination" /></label><button className="border border-foreground bg-foreground px-5 py-3 text-14 text-background disabled:opacity-50" disabled={loading}>{loading ? "Searching" : "Search"}</button></form>{error ? <p className="mt-4 text-14" role="alert">{error}</p> : null}<div className="mt-8"><InteractiveMap token={token} points={saved} routeGeometry={route?.geometry ?? []} onMapClick={(latitude, longitude) => void handleMapClick(latitude, longitude)} /></div>{reverseError ? <p className="mt-4 text-14" role="alert">{reverseError}</p> : null}<div className="mt-8 grid gap-3 sm:grid-cols-2">{places.map((place) => <article key={place.id} className="border border-line p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-display text-20 font-bold text-foreground">{place.name}</h3><p className="mt-2 text-14 text-graphite">{place.address}</p><p className="mt-3 text-12 text-graphite">{place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}</p></div><button type="button" className="shrink-0 border border-foreground px-3 py-2 text-12" onClick={() => addPoint({ id: place.id, label: place.name, latitude: place.latitude, longitude: place.longitude })}>Save pin</button></div></article>)}</div><div className="mt-8 border-t border-line pt-6"><div className="flex flex-wrap items-end gap-4"><div><p className="text-12 text-graphite">Saved stops</p><p className="mt-2 font-display text-24 text-foreground">{saved.length}</p></div><label className="text-12 text-graphite">Route mode<select className="mt-2 block border-b border-line bg-transparent py-2 text-14 text-foreground outline-none" value={profile} onChange={(event) => setProfile(event.target.value as RouteProfile)}><option value="walking">Walking</option><option value="cycling">Cycling</option><option value="driving">Driving</option></select></label><button type="button" className="border border-foreground bg-foreground px-5 py-3 text-14 text-background disabled:opacity-50" disabled={saved.length < 2 || routeLoading} onClick={() => void buildRoute()}>{routeLoading ? "Planning route" : "Route saved stops"}</button></div>{saved.length > 0 ? <ol className="mt-5 grid gap-2 text-14 text-foreground sm:grid-cols-2">{saved.map((point, index) => <li key={point.id} className="flex items-center gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-foreground text-12 text-background">{index + 1}</span><span className="truncate">{point.label}</span><button type="button" className="ml-auto text-12 text-graphite underline" onClick={() => { setSaved((current) => current.filter((item) => item.id !== point.id)); setRoute(null); }}>Remove</button></li>)}</ol> : <p className="mt-5 text-14 text-graphite">Save a search result or click the map to place your first pinpoint.</p>}{route ? <p className="mt-5 text-14 text-foreground">{route.profile} route: {route.distanceKm} km · about {route.durationMinutes} minutes.</p> : null}</div></div>;
}
