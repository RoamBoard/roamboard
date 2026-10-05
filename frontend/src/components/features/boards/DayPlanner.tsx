/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";

import AddPinDialog from "@/components/features/boards/AddPinDialog";
import PinEditorDialog from "@/components/features/boards/PinEditorDialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PinCategoryIcon from "@/components/ui/PinCategoryIcon";
import { dayColors, type BoardDayDraft, type BoardImageDraft, type BoardPinDraft } from "@/types/board-creator";

type Props = {
  days: BoardDayDraft[];
  images: BoardImageDraft[];
  onAddDay: () => void;
  onRemoveDay: (dayId: string) => void;
  onAddPin: (dayId: string, pin: BoardPinDraft, image: BoardImageDraft | null) => void;
  onUpdatePin: (pin: BoardPinDraft) => void;
  onMovePin: (pinId: string, dayId: string, time: string) => void;
  onRemovePin: (pinId: string) => void;
  onSetPinImage: (image: BoardImageDraft) => void;
  confirmedPhotoPins: Set<string>;
  onConfirmPhotoPin: (pinId: string) => void;
};

function timeFromDrop(event: React.DragEvent<HTMLElement>): string {
  const bounds = event.currentTarget.getBoundingClientRect();
  const offset = event.clientY - bounds.top + event.currentTarget.scrollTop;
  const ratio = Math.min(1, Math.max(0, offset / event.currentTarget.scrollHeight));
  const totalMinutes = Math.round((6 * 60 + ratio * 17 * 60) / 30) * 30;
  const hours = Math.min(23, Math.floor(totalMinutes / 60));
  return `${String(hours).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function DayPhaseIcon({ phase }: { phase: "sunrise" | "day" | "night" }) {
  if (phase === "night") return <svg aria-label="Night" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 15a7 7 0 0 1-10-10 8 8 0 1 0 10 10Z" /></svg>;
  return <svg aria-label={phase === "sunrise" ? "Morning" : "Daytime"} viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r={phase === "sunrise" ? "4" : "5"} /><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2m0-14-2 2M7 17l-2 2" /></svg>;
}

type DayColumnProps = {
  day: BoardDayDraft;
  dayIndex: number;
  images: BoardImageDraft[];
  onOpenPin: (pinId: string) => void;
  onAdd: () => void;
  onRemoveDay: () => void;
  canRemoveDay: boolean;
  onMovePin: Props["onMovePin"];
  confirmedPhotoPins: Set<string>;
  onConfirmPhotoPin: Props["onConfirmPhotoPin"];
};

function DayColumn({ day, dayIndex, images, onOpenPin, onAdd, onRemoveDay, canRemoveDay, onMovePin, confirmedPhotoPins, onConfirmPhotoPin }: DayColumnProps) {
  const scrollerRef = useRef<HTMLOListElement>(null);
  const imageByPin = new Map(images.filter((image) => image.pinId).map((image) => [image.pinId, image]));
  return (
    <article className="w-[21rem] shrink-0 snap-start sm:w-[24rem]" aria-labelledby={`day-${day.id}`}>
      <div className="flex min-h-20 items-end justify-between gap-4">
        <div><span className="mb-3 block h-1 w-11" style={{ backgroundColor: dayColors[dayIndex % dayColors.length] }} /><h3 id={`day-${day.id}`} className="font-display text-30 font-bold">DAY {day.dayNumber}</h3></div>
        <div className="text-right"><time className="block text-12 text-graphite">{day.date ?? "date open"}</time>{canRemoveDay ? <button type="button" onClick={onRemoveDay} className="mt-2 text-10 text-stone underline underline-offset-4">remove day</button> : null}</div>
      </div>
      <div className="relative mt-5 pl-12">
        <div aria-hidden="true" className="absolute bottom-0 left-4 top-0 border-l-2 border-foreground/35">
          <span className="absolute -left-2.5 top-[7%] grid size-5 place-items-center bg-background text-graphite"><DayPhaseIcon phase="sunrise" /></span>
          <span className="absolute -left-2.5 top-[47%] grid size-5 place-items-center bg-background text-graphite"><DayPhaseIcon phase="day" /></span>
          <span className="absolute -left-2.5 top-[87%] grid size-5 place-items-center bg-background text-graphite"><DayPhaseIcon phase="night" /></span>
        </div>
        <div className="absolute -right-1 top-2 z-10 flex flex-col border border-line bg-background">
          <button type="button" onClick={() => scrollerRef.current?.scrollBy({ top: -280, behavior: scrollBehavior() })} className="grid size-8 place-items-center border-b border-line" aria-label={`Scroll day ${day.dayNumber} activities up`}>↑</button>
          <button type="button" onClick={() => scrollerRef.current?.scrollBy({ top: 280, behavior: scrollBehavior() })} className="grid size-8 place-items-center" aria-label={`Scroll day ${day.dayNumber} activities down`}>↓</button>
        </div>
        <ol
          ref={scrollerRef}
          className="h-[34rem] snap-y overflow-y-auto pr-2"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const pinId = event.dataTransfer.getData("text/roamboard-pin");
            if (pinId) onMovePin(pinId, day.id, timeFromDrop(event));
          }}
        >
          <li aria-hidden="true" className="h-8" />
          {day.pins.map((pin) => {
            const image = imageByPin.get(pin.id);
            return (
              <li key={pin.id} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/roamboard-pin", pin.id); }} className="mb-3 snap-start">
                <button type="button" onClick={() => onOpenPin(pin.id)} className="group relative flex min-h-20 w-full cursor-grab items-stretch border border-line bg-background text-left active:cursor-grabbing">
                  <time className="absolute right-full top-1/2 mr-3 -translate-y-1/2 text-10 text-stone">{pin.time}</time>
                  {image ? <img src={image.thumbnailUrl} alt="" className="w-20 shrink-0 object-cover" /> : <span className="grid w-16 shrink-0 place-items-center bg-faint text-graphite"><PinCategoryIcon category={pin.category} className="size-6" /></span>}
                  <span className="min-w-0 flex-1 px-4 py-3"><strong className="block truncate text-13 font-medium">{pin.title}</strong><span className="mt-1 block truncate text-10 text-graphite">{pin.location?.address || pin.description || "Manual activity"}</span><span className="mt-2 inline-flex items-center gap-1 text-9 uppercase tracking-label text-stone"><PinCategoryIcon category={pin.category} className="size-3" />{pin.category}</span></span><span aria-hidden="true" className="self-center pr-3 text-20 text-stone">›</span>
                </button>
                {pin.source === "photo" && !confirmedPhotoPins.has(pin.id) ? <button type="button" onClick={() => onConfirmPhotoPin(pin.id)} className="mt-1 border-b border-foreground text-10 text-foreground">confirm photo location</button> : null}
              </li>
            );
          })}
          {day.pins.length === 0 ? <li className="grid h-[28rem] place-items-center border border-dashed border-line px-8 text-center text-12 text-stone">No pins yet. Add an activity or drop one here from another day.</li> : null}
          <li aria-hidden="true" className="h-24" />
        </ol>
      </div>
      <button type="button" onClick={onAdd} className="ml-12 mt-4 text-12 text-graphite hover:text-foreground focus-visible:outline-1 focus-visible:outline-offset-4">＋ Add activity</button>
    </article>
  );
}

export default function DayPlanner({ days, images, onAddDay, onRemoveDay, onAddPin, onUpdatePin, onMovePin, onRemovePin, onSetPinImage, confirmedPhotoPins, onConfirmPhotoPin }: Props) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [dialogDayId, setDialogDayId] = useState<string | null>(null);
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [removingDayId, setRemovingDayId] = useState<string | null>(null);
  const dialogDay = days.find((day) => day.id === dialogDayId) ?? null;
  const editingPin = days.flatMap((day) => day.pins).find((pin) => pin.id === editingPinId) ?? null;
  const editingImage = images.find((image) => image.pinId === editingPinId) ?? null;
  const removingDay = days.find((day) => day.id === removingDayId) ?? null;

  function requestRemoveDay(day: BoardDayDraft) {
    if (days.length === 1) return;
    if (day.pins.length === 0) onRemoveDay(day.id);
    else setRemovingDayId(day.id);
  }

  function openExistingPin(pinId: string) {
    setDialogDayId(null);
    setEditingPinId(pinId);
  }

  return (
    <>
      <div className="mb-4 flex justify-end gap-2"><button type="button" onClick={() => stripRef.current?.scrollBy({ left: -stripRef.current.clientWidth * 0.85, behavior: scrollBehavior() })} className="grid size-10 place-items-center border border-line" aria-label="Previous days">←</button><button type="button" onClick={() => stripRef.current?.scrollBy({ left: stripRef.current.clientWidth * 0.85, behavior: scrollBehavior() })} className="grid size-10 place-items-center border border-line" aria-label="Next days">→</button></div>
      <div ref={stripRef} className="flex snap-x snap-mandatory gap-8 overflow-x-auto pb-6" aria-label="Board day plans">
        {days.map((day, dayIndex) => <DayColumn key={day.id} day={day} dayIndex={dayIndex} images={images} onOpenPin={openExistingPin} onAdd={() => setDialogDayId(day.id)} onRemoveDay={() => requestRemoveDay(day)} canRemoveDay={days.length > 1} onMovePin={onMovePin} confirmedPhotoPins={confirmedPhotoPins} onConfirmPhotoPin={onConfirmPhotoPin} />)}
        <button type="button" onClick={onAddDay} className="grid min-h-[40rem] w-44 shrink-0 snap-start place-items-center border border-dashed border-line text-12 text-graphite hover:border-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2">＋ add day</button>
      </div>
      <p className="mt-2 text-12 text-graphite">Drag a pin vertically to change its time, or drop it into another day. Day lists scroll independently and times snap to 30-minute intervals.</p>
      {dialogDay ? <AddPinDialog day={dialogDay} days={days} onAdd={(dayId, pin, image) => onAddPin(dayId, pin, images.length < 10 ? image : null)} onClose={() => setDialogDayId(null)} onEditExisting={openExistingPin} /> : null}
      {editingPin ? <PinEditorDialog pin={editingPin} image={editingImage} canUpload={images.length < 10} onClose={() => setEditingPinId(null)} onSave={onUpdatePin} onDelete={() => { onRemovePin(editingPin.id); setEditingPinId(null); }} onSetImage={onSetPinImage} /> : null}
      {removingDay ? <ConfirmDialog title={`Remove day ${removingDay.dayNumber}?`} description={`This will remove the day and its ${removingDay.pins.length} pin${removingDay.pins.length === 1 ? "" : "s"}. This cannot be undone inside this editor.`} confirmLabel="Remove day and pins" onCancel={() => setRemovingDayId(null)} onConfirm={() => { onRemoveDay(removingDay.id); setRemovingDayId(null); }} /> : null}
    </>
  );
}
