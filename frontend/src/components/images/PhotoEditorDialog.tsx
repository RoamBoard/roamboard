/* eslint-disable @next/next/no-img-element */
"use client";
import { useEffect, useRef, useState } from "react";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import {
    cropAspect,
    fullCrop,
    originalPhotoUrl,
    outputSize,
    readPhotoEdit,
    savePhotoEdit,
    type PhotoEdit
} from "@/lib/photo-editing";
import { photoWasEdited } from "@/lib/use-photo-urls";
import { useBoardLeaveWarning } from "@/lib/use-board-leave-warning";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
export default function PhotoEditorDialog({ imageId, onClose }: { imageId: number; onClose: () => void }) {
    const ref = useRef<HTMLDivElement>(null),
        stage = useRef<HTMLDivElement>(null);
    const [image, setImage] = useState<{ url: string; width: number; height: number } | null>(null);
    const [edit, setEdit] = useState<PhotoEdit>({ ...fullCrop, outputWidth: 1600, outputHeight: 1200 });
    const [revision, setRevision] = useState<number | null>(null),
        [initial, setInitial] = useState(""),
        [busy, setBusy] = useState(false),
        [error, setError] = useState(""),
        [discard, setDiscard] = useState(false),
        [retry, setRetry] = useState(0);
    const [aspect, setAspect] = useState<number | null>(null);
    const [outputInput, setOutputInput] = useState<string | null>(null);
    const drag = useRef<{ x: number; y: number; crop: PhotoEdit; resize: boolean } | null>(null);
    const changed = Boolean(initial) && JSON.stringify(edit) !== initial;
    useBoardLeaveWarning(changed || busy);
    function close() {
        if (busy) return;
        if (changed) setDiscard(true);
        else onClose();
    }
    useDialogFocus(ref, close, !discard);
    useEffect(() => {
        const controller = new AbortController();
        const resource: { url?: string } = {};
        void Promise.all([
            readPhotoEdit(imageId, controller.signal),
            fetch(originalPhotoUrl(imageId), { credentials: "include", signal: controller.signal }).then(
                async (response) => {
                    if (!response.ok) throw new Error("The original photo could not load.");
                    return response.blob();
                }
            )
        ])
            .then(async ([saved, blob]) => {
                if (controller.signal.aborted) return;
                resource.url = URL.createObjectURL(blob);
                const picture = new Image();
                picture.src = resource.url;
                await picture.decode();
                if (controller.signal.aborted) return;
                const current = saved.edit ?? {
                    ...fullCrop,
                    ...outputSize(Math.min(1600, picture.naturalWidth), picture.naturalWidth / picture.naturalHeight)
                };
                setImage({ url: resource.url, width: picture.naturalWidth, height: picture.naturalHeight });
                setEdit(current);
                setInitial(JSON.stringify(current));
                setRevision(saved.revision);
            })
            .catch((caught) => {
                if (!controller.signal.aborted)
                    setError(caught instanceof Error ? caught.message : "Photo editing is unavailable.");
            });
        return () => {
            controller.abort();
            if (resource.url) URL.revokeObjectURL(resource.url);
        };
    }, [imageId, retry]);
    function crop(next: typeof fullCrop, targetAspect = aspect) {
        if (!image) return;
        const bounded = targetAspect ? cropAspect(next, image.width / image.height, targetAspect) : next;
        const ratio = (bounded.width * image.width) / (bounded.height * image.height);
        setEdit((current) => ({ ...bounded, ...outputSize(current.outputWidth, ratio) }));
    }
    async function save(reset = false) {
        if (revision === null || busy) return;
        setBusy(true);
        setError("");
        try {
            const saved = await savePhotoEdit(imageId, revision, reset ? null : edit);
            photoWasEdited(imageId, saved.revision);
            onClose();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Photo edits could not be saved.");
        } finally {
            setBusy(false);
        }
    }
    return (
        <>
            {discard ? (
                <ConfirmDialog
                    title="Discard photo edits?"
                    description="Your saved photo will keep its previous crop and size."
                    confirmLabel="Discard edits"
                    onCancel={() => setDiscard(false)}
                    onConfirm={onClose}
                />
            ) : null}
            <div
                className="fixed inset-0 z-[80] grid place-items-center bg-black/65 p-4"
                inert={discard}
                onMouseDown={(event) => {
                    if (event.target === event.currentTarget) close();
                }}
            >
                <div
                    ref={ref}
                    tabIndex={-1}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="photo-editor-heading"
                    className="bg-background text-foreground max-h-[94dvh] w-full max-w-4xl overflow-y-auto p-5 shadow-2xl sm:p-8"
                >
                    <header className="mb-5 flex items-center justify-between gap-4">
                        <h2 id="photo-editor-heading" className="font-display text-24 font-bold">
                            Edit photo
                        </h2>
                        <button
                            type="button"
                            disabled={busy}
                            aria-label="Close photo editor"
                            className="border-line size-10 border"
                            onClick={close}
                        >
                            ×
                        </button>
                    </header>
                    <p className="text-muted-foreground mb-5 text-xs leading-relaxed">
                        Crop, choose an aspect ratio and resize. Your original photo and location metadata are
                        preserved. Saved edits apply wherever this upload is used.
                    </p>
                    {image ? (
                        <>
                            <div
                                ref={stage}
                                className="relative mx-auto max-h-[48dvh] w-fit max-w-full overflow-hidden bg-black"
                                style={{ aspectRatio: `${image.width}/${image.height}` }}
                                onPointerMove={(event) => {
                                    const start = drag.current;
                                    if (!start || !stage.current) return;
                                    const box = stage.current.getBoundingClientRect();
                                    const dx = (event.clientX - start.x) / box.width,
                                        dy = (event.clientY - start.y) / box.height;
                                    if (start.resize)
                                        crop({
                                            ...start.crop,
                                            width: Math.max(0.01, Math.min(1 - start.crop.x, start.crop.width + dx)),
                                            height: Math.max(0.01, Math.min(1 - start.crop.y, start.crop.height + dy))
                                        });
                                    else
                                        crop({
                                            ...start.crop,
                                            x: Math.max(0, Math.min(1 - start.crop.width, start.crop.x + dx)),
                                            y: Math.max(0, Math.min(1 - start.crop.height, start.crop.y + dy))
                                        });
                                }}
                                onPointerUp={() => {
                                    drag.current = null;
                                }}
                                onPointerCancel={() => {
                                    drag.current = null;
                                }}
                            >
                                <img
                                    src={image.url}
                                    alt="Original photo with crop selection"
                                    draggable={false}
                                    className="block max-h-[48dvh] max-w-full select-none"
                                />
                                <div
                                    className="absolute cursor-move touch-none border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
                                    style={{
                                        left: edit.x * 100 + "%",
                                        top: edit.y * 100 + "%",
                                        width: edit.width * 100 + "%",
                                        height: edit.height * 100 + "%"
                                    }}
                                    onPointerDown={(event) => {
                                        if (busy) return;
                                        event.currentTarget.setPointerCapture(event.pointerId);
                                        drag.current = {
                                            x: event.clientX,
                                            y: event.clientY,
                                            crop: edit,
                                            resize: false
                                        };
                                    }}
                                >
                                    <span className="pointer-events-none absolute inset-x-1/3 inset-y-0 border-x border-white/40" />
                                    <span className="pointer-events-none absolute inset-x-0 inset-y-1/3 border-y border-white/40" />
                                    <button
                                        type="button"
                                        disabled={busy}
                                        aria-label="Resize crop by dragging; use crop sliders for keyboard adjustment"
                                        className="absolute -right-2 -bottom-2 size-5 cursor-se-resize touch-none border-2 border-black bg-white"
                                        onPointerDown={(event) => {
                                            event.stopPropagation();
                                            event.currentTarget.setPointerCapture(event.pointerId);
                                            drag.current = {
                                                x: event.clientX,
                                                y: event.clientY,
                                                crop: edit,
                                                resize: true
                                            };
                                        }}
                                    />
                                </div>
                            </div>
                            <fieldset disabled={busy} className="mt-6 grid gap-5 sm:grid-cols-2">
                                <label className="text-xs">
                                    Aspect ratio
                                    <select
                                        aria-label="Photo aspect ratio"
                                        defaultValue="free"
                                        className="border-line mt-2 w-full border p-3"
                                        onChange={(event) => {
                                            const next =
                                                event.target.value === "free"
                                                    ? null
                                                    : event.target.value === "original"
                                                      ? image.width / image.height
                                                      : Number(event.target.value);
                                            setAspect(next);
                                            if (next) crop(fullCrop, next);
                                        }}
                                    >
                                        <option value="free">Free crop</option>
                                        <option value="original">Original ratio</option>
                                        <option value="1">Square / 1:1</option>
                                        <option value={4 / 3}>Landscape / 4:3</option>
                                        <option value={3 / 2}>Photo / 3:2</option>
                                        <option value={16 / 9}>Wide / 16:9</option>
                                        <option value={9 / 16}>Portrait / 9:16</option>
                                    </select>
                                </label>
                                <label className="text-xs">
                                    Image width (pixels)
                                    <input
                                        type="number"
                                        min={32}
                                        max={4096}
                                        value={outputInput ?? edit.outputWidth}
                                        onChange={(event) => {
                                            const raw = event.target.value;
                                            setOutputInput(raw);
                                            const width = Number(raw);
                                            if (width >= 32 && width <= 4096)
                                                setEdit((current) => ({
                                                    ...current,
                                                    ...outputSize(
                                                        width,
                                                        (current.width * image.width) / (current.height * image.height)
                                                    )
                                                }));
                                        }}
                                        onBlur={() => {
                                            const width = outputInput?.trim() ? Number(outputInput) : edit.outputWidth;
                                            setEdit((current) => ({
                                                ...current,
                                                ...outputSize(
                                                    width,
                                                    (current.width * image.width) / (current.height * image.height)
                                                )
                                            }));
                                            setOutputInput(null);
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") event.currentTarget.blur();
                                        }}
                                        className="border-line mt-2 w-full border p-3"
                                    />
                                    <span className="text-muted-foreground mt-2 block">
                                        {edit.outputWidth} × {edit.outputHeight} px maximum
                                    </span>
                                </label>
                                {(
                                    [
                                        ["x", "Crop left"],
                                        ["y", "Crop top"],
                                        ["width", "Crop width"],
                                        ["height", "Crop height"]
                                    ] as const
                                ).map(([key, label]) => (
                                    <label key={key} className="text-xs">
                                        {label} / {Math.round(edit[key] * 100)}%
                                        <input
                                            className="mt-3 block w-full"
                                            type="range"
                                            min={key === "width" || key === "height" ? 0.01 : 0}
                                            max={
                                                key === "x"
                                                    ? 1 - edit.width
                                                    : key === "y"
                                                      ? 1 - edit.height
                                                      : key === "width"
                                                        ? 1 - edit.x
                                                        : 1 - edit.y
                                            }
                                            step={0.001}
                                            value={edit[key]}
                                            onChange={(event) => crop({ ...edit, [key]: Number(event.target.value) })}
                                        />
                                    </label>
                                ))}
                            </fieldset>
                        </>
                    ) : !error ? (
                        <p role="status" className="py-20 text-center text-sm">
                            Loading your original photo...
                        </p>
                    ) : null}
                    {error ? (
                        <div role="alert" className="mt-5 text-sm">
                            {error}
                            {!image ? (
                                <button
                                    type="button"
                                    className="ml-3 underline"
                                    onClick={() => {
                                        setError("");
                                        setRetry((current) => current + 1);
                                    }}
                                >
                                    Try again
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                    <footer className="mt-7 flex flex-wrap justify-between gap-3">
                        <button
                            type="button"
                            disabled={busy || revision === null}
                            className="border-line border px-4 py-3 text-xs"
                            onClick={() => void save(true)}
                        >
                            Reset to original
                        </button>
                        <button
                            type="button"
                            disabled={busy || !image || revision === null}
                            className="bg-foreground text-background px-6 py-3 text-sm"
                            onClick={() => void save()}
                        >
                            {busy ? "Saving photo..." : "Save photo"}
                        </button>
                    </footer>
                </div>
            </div>
        </>
    );
}
