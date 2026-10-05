/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import InteractiveMap, { type MapPoint } from "@/components/features/providers/InteractiveMap";
import PinCategoryIcon from "@/components/ui/PinCategoryIcon";
import { categoryFromMapboxType, pinCategories } from "@/lib/board-options";
import { loadMapboxMapSession, loadProviderConfig, searchBoardMapboxProvider, searchUnsplashProvider, type MapboxSearchResult, type ProviderPhoto } from "@/lib/providers";
import { dayColors, type BoardDayDraft, type BoardImageDraft, type BoardPinDraft, type PinCategory, type PinLocation } from "@/types/board-creator";

type Props = {
  day: BoardDayDraft;
  days: BoardDayDraft[];
  onClose: () => void;
  onAdd: (dayId: string, pin: BoardPinDraft, image: BoardImageDraft | null) => void;
  onEditExisting: (pinId: string) => void;
};

function mapPoint(pin: BoardPinDraft, dayIndex: number): MapPoint | null {
  if (!pin.location) return null;
  return { id: pin.id, label: pin.title, detail: pin.location.address, type: pin.category, latitude: pin.location.latitude, longitude: pin.location.longitude, color: dayColors[dayIndex % dayColors.length] };
}

function locationFromResult(place: MapboxSearchResult): PinLocation {
  return { name: place.name, address: place.address, latitude: place.latitude, longitude: place.longitude, country: place.country, countryCode: place.countryCode, city: place.city, mapboxId: place.id };
}

function imageFromPhoto(photo: ProviderPhoto, pinId: string): BoardImageDraft {
  return { id: crypto.randomUUID(), pinId, publicId: photo.id, source: "unsplash", url: photo.url, thumbnailUrl: photo.thumbnailUrl, width: photo.width, height: photo.height, capturedAt: null, latitude: null, longitude: null, order: 0, credit: photo.photographer, creditUrl: photo.photographerUrl, sourceUrl: photo.sourceUrl };
}

export default function AddPinDialog({ day, days, onClose, onAdd, onEditExisting }: Props) {
  const photoRequestRef = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState<string>();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MapboxSearchResult[]>([]);
  const [selected, setSelected] = useState<PinLocation | null>(null);
  const [photo, setPhoto] = useState<ProviderPhoto | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [time, setTime] = useState("09:00");
  const [category, setCategory] = useState<PinCategory>("activity");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const points = useMemo(() => days.flatMap((boardDay, dayIndex) => boardDay.pins.flatMap((pin) => {
    const point = mapPoint(pin, dayIndex);
    return point ? [point] : [];
  })).concat(selected ? [{ id: "selected-place", label: title || selected.name, detail: selected.address, type: category, latitude: selected.latitude, longitude: selected.longitude, color: dayColors[(day.dayNumber - 1) % dayColors.length] }] : []), [days, selected, title, category, day.dayNumber]);

  useEffect(() => {
    dialogRef.current?.focus();
    void loadProviderConfig()
      .then((config) => config.mapbox.configured ? loadMapboxMapSession() : Promise.reject(new Error("Mapbox is not configured.")))
      .then((session) => setToken(session.publicToken))
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "The map could not load."));
  }, []);

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length < 2) {
      setError("Enter at least two characters to search.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const places = await searchBoardMapboxProvider(query.trim());
      const priority = (place: MapboxSearchResult) => ["place", "poi"].includes(place.placeType) ? 0 : ["locality", "neighborhood", "district", "region", "country"].includes(place.placeType) ? 1 : 2;
      setResults([...places].sort((first, second) => priority(first) - priority(second)));
    } catch (caught) {
      setResults([]);
      const message = caught instanceof Error ? caught.message : "Location search failed.";
      setError(message.includes("Route GET") ? "The Board search endpoint is not loaded. Restart the backend dev server, then try again." : message);
    } finally {
      setLoading(false);
    }
  }

  async function selectPlace(place: MapboxSearchResult) {
    const requestId = ++photoRequestRef.current;
    setResults([]);
    setSelected(locationFromResult(place));
    setTitle(place.name);
    setCategory(categoryFromMapboxType(place.placeType));
    setPhoto(null);
    setError("");
    try {
      const name = place.name.replace(/-shi$/i, "");
      const terms = [...new Set([name, place.city?.replace(/-shi$/i, ""), place.country].filter(Boolean))];
      const photos = await searchUnsplashProvider(terms.join(" "));
      if (photoRequestRef.current === requestId) setPhoto(photos[0] ?? null);
    } catch (caught) {
      if (photoRequestRef.current === requestId) {
        setPhoto(null);
        setError(caught instanceof Error ? caught.message : "The location photo could not load.");
      }
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Give this pin a title.");
      return;
    }
    const pinId = crypto.randomUUID();
    onAdd(day.id, { id: pinId, order: day.pins.length, time, title: trimmedTitle, description: description.trim(), category, source: selected ? "mapbox" : "manual", location: selected }, photo ? imageFromPhoto(photo, pinId) : null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-3 sm:p-8" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="add-pin-heading" tabIndex={-1} className="max-h-[92dvh] w-full max-w-6xl overflow-y-auto bg-background shadow-2xl outline-none">
        <header className="flex items-start justify-between border-b border-line p-5 sm:p-7">
          <div><p className="text-10 font-bold uppercase tracking-label text-graphite">Day {day.dayNumber}</p><h2 id="add-pin-heading" className="mt-2 font-display text-30 font-bold">Add a pin</h2></div>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center border border-line text-24 focus-visible:outline-2 focus-visible:outline-offset-2" aria-label="Close activity dialog">×</button>
        </header>
        <div className="grid lg:grid-cols-[0.85fr_1.15fr]">
          <div className="border-b border-line p-5 lg:border-b-0 lg:border-r sm:p-7">
            <form onSubmit={(event) => void search(event)}>
              <label htmlFor="pin-place-search" className="text-12 text-graphite">Search Mapbox</label>
              <div className="mt-2 flex gap-3"><input id="pin-place-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Senso-ji, Tokyo" className="min-w-0 flex-1 border-b border-line bg-transparent py-3 text-15 outline-none focus:border-foreground" /><button disabled={loading} className="border border-foreground bg-foreground px-4 text-12 text-background disabled:opacity-45">{loading ? "Searching" : "Search"}</button></div>
            </form>
            {error ? <p className="mt-4 text-13" role="alert">{error}</p> : null}
            <ul className="mt-5 grid gap-2">{results.map((place) => <li key={place.id}><button type="button" onClick={() => void selectPlace(place)} className="w-full border border-line p-4 text-left hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2"><span className="flex flex-wrap items-center gap-2"><strong className="text-14">{place.name}</strong><span className="border border-line px-2 py-1 text-10 uppercase tracking-label text-graphite">{pinCategories.find((item) => item.value === categoryFromMapboxType(place.placeType))?.label}</span></span><span className="mt-1 block text-12 text-graphite">{place.address}</span></button></li>)}</ul>
            <form className="mt-7 border-t border-line pt-6" onSubmit={submit}>
              {photo ? <figure className="mb-5"><img src={photo.thumbnailUrl} alt={photo.alt} className="aspect-video w-full object-cover" /><figcaption className="mt-1 text-10 text-stone">Photo by <a href={photo.photographerUrl} target="_blank" rel="noreferrer" className="underline">{photo.photographer}</a> on <a href={photo.sourceUrl} target="_blank" rel="noreferrer" className="underline">Unsplash</a></figcaption></figure> : null}
              <div className="grid gap-5 sm:grid-cols-[8rem_1fr]"><label className="text-12 text-graphite">Time<input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="mt-2 w-full border-b border-line bg-transparent py-2 text-15 text-foreground outline-none focus:border-foreground" /></label><label className="text-12 text-graphite">Pin title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Activity or place" className="mt-2 w-full border-b border-line bg-transparent py-2 text-15 text-foreground outline-none focus:border-foreground" /></label></div>
              <label className="mt-5 block text-12 text-graphite">Category<span className="mt-2 flex items-center gap-3 border-b border-line py-2"><PinCategoryIcon category={category} /><select value={category} onChange={(event) => setCategory(event.target.value as PinCategory)} className="min-w-0 flex-1 bg-transparent text-14 text-foreground outline-none">{pinCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></span></label>
              <label className="mt-5 block text-12 text-graphite">Notes<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What should you remember?" rows={3} className="mt-2 w-full resize-y border border-line bg-transparent p-3 text-14 text-foreground outline-none focus:border-foreground" /></label>
              <p className="mt-4 text-12 text-graphite">{selected ? `Selected: ${selected.address}` : "No location selected. This will be saved as a manual activity."}</p>
              <button className="mt-5 w-full border border-foreground bg-foreground px-5 py-3 text-14 text-background">Add to day {day.dayNumber}</button>
            </form>
          </div>
          <div className="p-5 sm:p-7">
            <div className="mb-4 flex flex-wrap gap-4 text-12 text-graphite">{days.map((boardDay, index) => <span key={boardDay.id} className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ backgroundColor: dayColors[index % dayColors.length] }} />Day {boardDay.dayNumber}</span>)}</div>
            <InteractiveMap token={token} points={points} routeGeometry={[]} onPointClick={(point) => { if (point.id !== "selected-place") onEditExisting(point.id); }} />
            <p className="mt-3 text-12 text-graphite">Existing Board pins are clickable. Search results must be selected from the list; the map itself does not create pins.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
