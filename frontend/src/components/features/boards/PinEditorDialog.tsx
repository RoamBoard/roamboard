/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";

import PinCategoryIcon from "@/components/ui/PinCategoryIcon";
import { pinCategories } from "@/lib/board-options";
import { buildCloudinaryDelivery, uploadCloudinaryProvider } from "@/lib/providers";
import type { BoardImageDraft, BoardPinDraft, PinCategory } from "@/types/board-creator";

type Props = {
  pin: BoardPinDraft;
  image: BoardImageDraft | null;
  canUpload: boolean;
  onClose: () => void;
  onSave: (pin: BoardPinDraft) => void;
  onDelete: () => void;
  onSetImage: (image: BoardImageDraft) => void;
};

export default function PinEditorDialog({ pin, image, canUpload, onClose, onSave, onDelete, onSetImage }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(pin);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [delivery, setDelivery] = useState<{ publicId: string; url: string } | null>(null);
  const coverUrl = image?.source === "upload" ? (delivery?.publicId === image.publicId ? delivery.url : image.thumbnailUrl) : image?.url;

  useEffect(() => {
    const request = { active: true };
    if (image?.source === "upload") {
      void buildCloudinaryDelivery(image.publicId, "1200", "800", "fit")
        .then(({ url }) => { if (request.active) setDelivery({ publicId: image.publicId, url }); })
        .catch((caught: unknown) => { if (request.active) setError(caught instanceof Error ? caught.message : "The cover image could not load."); });
    }
    return () => { request.active = false; };
  }, [image?.publicId, image?.source, image?.url]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const asset = await uploadCloudinaryProvider(file);
      onSetImage({ id: image?.id ?? crypto.randomUUID(), pinId: pin.id, publicId: asset.publicId, source: "upload", url: asset.url, thumbnailUrl: asset.thumbnailUrl, width: asset.width, height: asset.height, capturedAt: asset.metadata?.capturedAt ?? null, latitude: asset.metadata?.latitude ?? null, longitude: asset.metadata?.longitude ?? null, order: image?.order ?? 0, credit: null, creditUrl: null, sourceUrl: null });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The cover image could not be uploaded.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="edit-pin-heading" className="max-h-[92dvh] w-full max-w-xl overflow-y-auto bg-background p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between"><div><p className="text-10 font-bold uppercase tracking-label text-stone">Edit itinerary pin</p><h2 id="edit-pin-heading" className="mt-2 font-display text-30 font-bold">{pin.title}</h2></div><button type="button" onClick={onClose} className="grid size-10 place-items-center border border-line text-22" aria-label="Close pin editor">×</button></div>
        {image ? <figure className="mt-6"><img src={coverUrl || image.thumbnailUrl} onError={() => setError("The cover image could not load. Try changing the cover image.")} alt={`Cover for ${pin.title}`} className="aspect-video w-full object-cover" />{image.credit && image.creditUrl && image.sourceUrl ? <figcaption className="mt-1 text-10 text-stone">Photo by <a href={image.creditUrl} target="_blank" rel="noreferrer" className="underline">{image.credit}</a> on <a href={image.sourceUrl} target="_blank" rel="noreferrer" className="underline">Unsplash</a></figcaption> : null}</figure> : null}
        <input ref={inputRef} type="file" accept="image/*,.heic,.heif" className="sr-only" onChange={(event) => void upload(event.target.files?.[0])} />
        <button type="button" disabled={uploading || (!canUpload && !image)} onClick={() => inputRef.current?.click()} className="mt-3 border-b border-foreground pb-1 text-12 disabled:opacity-40">{uploading ? "Uploading..." : image ? "Change cover image" : "Upload cover image"}</button>
        {error ? <p className="mt-3 text-12" role="alert">{error}</p> : null}
        <div className="mt-7 grid gap-5 sm:grid-cols-[8rem_1fr]"><label className="text-12 text-graphite">Time<input type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} className="mt-2 w-full border-b border-line bg-transparent py-2 text-15 text-foreground outline-none" /></label><label className="text-12 text-graphite">Title<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="mt-2 w-full border-b border-line bg-transparent py-2 text-15 text-foreground outline-none" /></label></div>
        <label className="mt-5 block text-12 text-graphite">Category<span className="mt-2 flex items-center gap-3 border-b border-line py-2"><PinCategoryIcon category={draft.category} /><select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as PinCategory })} className="min-w-0 flex-1 bg-transparent text-14 text-foreground outline-none">{pinCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></span></label>
        <label className="mt-5 block text-12 text-graphite">Notes<textarea rows={4} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="mt-2 w-full resize-y border border-line bg-transparent p-3 text-14 text-foreground outline-none" /></label>
        {draft.location ? <p className="mt-4 text-12 leading-5 text-graphite">{draft.location.address}</p> : null}
        <div className="mt-8 flex flex-wrap justify-between gap-3"><button type="button" onClick={onDelete} className="border border-line px-5 py-3 text-13">Delete activity</button><button type="button" onClick={() => { if (draft.title.trim()) { onSave({ ...draft, title: draft.title.trim(), description: draft.description.trim() }); onClose(); } }} className="border border-foreground bg-foreground px-6 py-3 text-13 text-background">Save pin</button></div>
      </div>
    </div>
  );
}
