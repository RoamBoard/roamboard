"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import BoardCreationPreview from "@/components/features/boards/BoardCreationPreview";
import BoardDiscoveryDetails from "@/components/features/boards/BoardDiscoveryDetails";
import BoardImageIntake, { type UploadedBoardImage } from "@/components/features/boards/BoardImageIntake";
import CreatorSectionIntro from "@/components/features/boards/CreatorSectionIntro";
import DayPlanner from "@/components/features/boards/DayPlanner";
import { createBoard } from "@/lib/boards";
import type { BoardVisibility } from "@/types/board";
import type { BoardCreatorPayload, BoardDayDraft, BoardImageDraft, BoardPinDraft, BoardStatus, CreatedBoard } from "@/types/board-creator";

function newDay(dayNumber: number, date: string | null = null): BoardDayDraft {
  return { id: crypto.randomUUID(), dayNumber, date, pins: [] };
}

function normalizePinOrder(pins: BoardPinDraft[]): BoardPinDraft[] {
  return [...pins]
    .sort((first, second) => first.time.localeCompare(second.time) || first.order - second.order)
    .map((pin, order) => ({ ...pin, order }));
}

function addPhotoSuggestions(current: BoardDayDraft[], uploads: UploadedBoardImage[]): BoardDayDraft[] {
  return uploads.reduce((days, upload) => {
    if (!upload.suggestedPin) return days;
    const suggestedPin = upload.suggestedPin;
    const matchingIndex = upload.suggestedDate
      ? days.findIndex((day) => day.date === upload.suggestedDate)
      : 0;
    const reusableFirstDay = days.length === 1 && days[0]?.pins.length === 0 && days[0].date === null;
    const targetIndex = matchingIndex >= 0 ? matchingIndex : reusableFirstDay ? 0 : days.length;
    if (targetIndex === days.length) {
      return [...days, { ...newDay(days.length + 1, upload.suggestedDate), pins: [{ ...suggestedPin, order: 0 }] }];
    }
    return days.map((day, index) => index === targetIndex
      ? {
          ...day,
          date: day.date ?? upload.suggestedDate,
          pins: normalizePinOrder([...day.pins, { ...suggestedPin, order: day.pins.length }]),
        }
      : day);
  }, current);
}

export default function BoardCreator() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<BoardImageDraft[]>([]);
  const [days, setDays] = useState<BoardDayDraft[]>(() => [newDay(1)]);
  const [tags, setTags] = useState<string[]>([]);
  const [vibes, setVibes] = useState<string[]>([]);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<BoardVisibility>("private");
  const [confirmedPhotoPins, setConfirmedPhotoPins] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState<BoardStatus | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savedBoard, setSavedBoard] = useState<CreatedBoard | null>(null);

  const suggestedHighlights = useMemo(() => {
    const names = days.flatMap((day) => day.pins.flatMap((pin) => pin.location?.name ? [pin.location.name] : []));
    const counts = names.reduce((current, name) => current.set(name, (current.get(name) ?? 0) + 1), new Map<string, number>());
    return [...counts.entries()].sort((first, second) => second[1] - first[1]).map(([name]) => name);
  }, [days]);

  const payload = useMemo<BoardCreatorPayload>(() => ({
    title,
    description,
    status: "draft",
    visibility,
    tags,
    vibes,
    highlights,
    days,
    images,
  }), [days, description, highlights, images, tags, title, vibes, visibility]);

  function handleUploads(items: UploadedBoardImage[]) {
    setImages((current) => [...current, ...items.map((item) => item.image)].map((image, order) => ({ ...image, order })));
    setDays((current) => addPhotoSuggestions(current, items));
    setMessage(items.some((item) => item.suggestedPin)
      ? "Images uploaded. Pins suggested from embedded GPS and capture times—please confirm them before publishing."
      : "Images uploaded. No usable GPS metadata was found, so no pins were created automatically.");
    setError("");
  }

  function removeImage(imageId: string) {
    const image = images.find((item) => item.id === imageId);
    setImages((current) => current.filter((item) => item.id !== imageId).map((item, order) => ({ ...item, order })));
    if (image?.pinId) setDays((current) => current.map((day) => ({ ...day, pins: normalizePinOrder(day.pins.filter((pin) => pin.id !== image.pinId)) })));
    if (image?.pinId) setConfirmedPhotoPins((current) => new Set([...current].filter((pinId) => pinId !== image.pinId)));
  }

  function addPin(dayId: string, pin: BoardPinDraft, image: BoardImageDraft | null) {
    setDays((current) => current.map((day) => day.id === dayId ? { ...day, pins: normalizePinOrder([...day.pins, pin]) } : day));
    if (image) setImages((current) => [...current, { ...image, order: current.length }]);
  }

  function updatePin(pin: BoardPinDraft) {
    setDays((current) => current.map((day) => ({ ...day, pins: normalizePinOrder(day.pins.map((item) => item.id === pin.id ? pin : item)) })));
  }

  function removePin(pinId: string) {
    setDays((current) => current.map((day) => ({ ...day, pins: normalizePinOrder(day.pins.filter((pin) => pin.id !== pinId)) })));
    setImages((current) => current.filter((image) => image.pinId !== pinId).map((image, order) => ({ ...image, order })));
    setConfirmedPhotoPins((current) => new Set([...current].filter((item) => item !== pinId)));
  }

  function removeDay(dayId: string) {
    const removedPinIds = new Set(days.find((day) => day.id === dayId)?.pins.map((pin) => pin.id) ?? []);
    setDays((current) => current.filter((day) => day.id !== dayId).map((day, index) => ({ ...day, dayNumber: index + 1 })));
    setImages((current) => current.filter((image) => !image.pinId || !removedPinIds.has(image.pinId)).map((image, order) => ({ ...image, order })));
    setConfirmedPhotoPins((current) => new Set([...current].filter((pinId) => !removedPinIds.has(pinId))));
  }

  function setPinImage(image: BoardImageDraft) {
    setImages((current) => {
      const withoutExisting = current.filter((item) => item.pinId !== image.pinId && item.id !== image.id);
      return [...withoutExisting, image].map((item, order) => ({ ...item, order }));
    });
  }

  function movePin(pinId: string, dayId: string, time: string) {
    const pin = days.flatMap((day) => day.pins).find((item) => item.id === pinId);
    if (!pin) return;
    setDays((current) => current.map((day) => {
      const withoutPin = day.pins.filter((item) => item.id !== pinId);
      return {
        ...day,
        pins: normalizePinOrder(day.id === dayId ? [...withoutPin, { ...pin, time }] : withoutPin),
      };
    }));
  }

  async function save(status: BoardStatus) {
    const unconfirmedPhotoPin = days.flatMap((day) => day.pins).find((pin) => pin.source === "photo" && !confirmedPhotoPins.has(pin.id));
    if (status === "published" && unconfirmedPhotoPin) {
      setError(`Confirm the photo location for “${unconfirmedPhotoPin.title}” before publishing.`);
      setMessage("");
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      document.getElementById("day-plan")?.scrollIntoView({ behavior, block: "start" });
      return;
    }
    setSaving(status);
    setError("");
    setMessage("");
    try {
      const board = await createBoard({ ...payload, status });
      setSavedBoard(board);
      setMessage(status === "draft"
        ? `Draft saved as “${board.title}”.`
        : `“${board.title}” is published and ready to share.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The Board could not be saved.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <article className="min-w-0 bg-background text-foreground">
      <header className="px-5 pb-16 pt-14 text-center sm:px-10 sm:pt-20">
        <h1 className="font-display text-48 font-bold leading-none tracking-tight sm:text-72 lg:text-96">SMART CREATE</h1>
        <p className="mx-auto mt-4 max-w-xl text-12 leading-5 text-graphite">Drop in your photos and we’ll turn metadata into editable beginnings for a Board. Review every suggestion before anything is published.</p>
        <p className="mt-6 text-10 text-stone">Powered by Roamboard Intelligence Engine</p>
      </header>

      <div className="px-4 sm:px-8 lg:px-16">
        <BoardImageIntake images={images} onUploaded={handleUploads} onRemove={removeImage} />

        <div className="mx-auto mt-8 max-w-4xl text-center">
          <label htmlFor="board-title" className="text-10 uppercase tracking-label text-stone">Board creator</label>
          <input id="board-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="BOARD TITLE" className="mt-2 w-full bg-transparent text-center font-display text-36 font-bold uppercase leading-none outline-none placeholder:text-foreground hover:placeholder:text-transparent focus:placeholder:text-transparent sm:text-48" />
        </div>

        {message ? <p className="mx-auto mt-7 max-w-3xl border-l-2 border-foreground pl-4 text-13" role="status">{message}</p> : null}
        {error ? <p className="mx-auto mt-7 max-w-3xl border-l-2 border-foreground pl-4 text-13" role="alert">{error}</p> : null}

        <section id="board-basics" className="mx-auto mt-24 grid max-w-7xl scroll-mt-8 gap-10 lg:grid-cols-[15rem_1fr] lg:gap-16">
          <CreatorSectionIntro number="01" title="BOARD BASICS" description="Let’s start with the essentials to set the scene for everything you’re about to plan." />
          <label className="block max-w-3xl font-display text-20 font-bold">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="type here..." rows={7} className="mt-3 w-full resize-y border-0 border-b border-line bg-transparent py-3 font-body text-14 font-normal leading-6 outline-none placeholder:text-stone focus:border-foreground" /></label>
        </section>

        <section id="day-plan" className="mx-auto mt-28 grid max-w-7xl scroll-mt-8 gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16">
          <CreatorSectionIntro number="02" title="BUILD YOUR DAY PLAN" description="Shape the trip. Add and arrange places, restaurants, notes, and more." />
          <div className="min-w-0"><DayPlanner days={days} images={images} onAddDay={() => setDays((current) => [...current, newDay(current.length + 1)])} onRemoveDay={removeDay} onAddPin={addPin} onUpdatePin={updatePin} onMovePin={movePin} onRemovePin={removePin} onSetPinImage={setPinImage} confirmedPhotoPins={confirmedPhotoPins} onConfirmPhotoPin={(pinId) => setConfirmedPhotoPins((current) => new Set([...current, pinId]))} /></div>
        </section>

        <section id="details-discovery" className="mx-auto mt-28 grid max-w-7xl scroll-mt-8 gap-10 lg:grid-cols-[15rem_1fr] lg:gap-16">
          <CreatorSectionIntro number="03" title="DETAILS & DISCOVERY" description="Give your Board more context to keep plans organized and make it easier for others to discover." />
          <BoardDiscoveryDetails tags={tags} vibes={vibes} highlights={highlights} suggestedHighlights={suggestedHighlights} visibility={visibility} onTagsChange={setTags} onVibesChange={setVibes} onHighlightsChange={setHighlights} onVisibilityChange={setVisibility} />
        </section>

        <section id="board-preview" className="mx-auto mt-28 grid max-w-7xl scroll-mt-8 gap-10 lg:grid-cols-[15rem_1fr] lg:gap-16">
          <CreatorSectionIntro number="04" title="BOARD PREVIEW" description="A final look at the trip you’ve built, just to make sure everything feels exactly how you want it." />
          <BoardCreationPreview board={payload} />
        </section>

        <section className="mx-auto mb-32 mt-28 grid max-w-7xl gap-10 lg:grid-cols-[15rem_1fr] lg:gap-16">
          <CreatorSectionIntro number="05" title="PUBLISH" description="Save it for yourself, or share it if you feel like it." />
          <div>
            <h2 className="font-display text-36 font-bold">Ready when you are.</h2>
            <p className="mt-3 max-w-xl text-14 leading-6 text-graphite">Drafts can stay incomplete. Publishing requires a title and at least one pin with a confirmed location.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button type="button" disabled={saving !== null} onClick={() => void save("draft")} className="border border-foreground px-6 py-4 text-14 disabled:opacity-40">{saving === "draft" ? "Saving draft..." : "Save as draft"}</button>
              <button type="button" disabled={saving !== null} onClick={() => void save("published")} className="border border-foreground bg-foreground px-6 py-4 text-14 text-background disabled:opacity-40">{saving === "published" ? "Publishing..." : "Publish Board"}</button>
              {savedBoard ? <Link href={`/boards/${savedBoard.id}`} className="border-b border-foreground px-2 py-4 text-14">View saved Board →</Link> : null}
            </div>
          </div>
        </section>
      </div>
    </article>
  );
}
