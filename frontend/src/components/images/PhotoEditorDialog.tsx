/* eslint-disable @next/next/no-img-element */
"use client";
import { useEffect, useRef, useState } from "react";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import {
    cropAspect,
    fullCrop,
    outputSize,
    readOriginalPhoto,
    readPhotoEdit,
    savePhotoEdit,
    type PhotoEdit
} from "@/lib/photo-editing";
import { photoWasEdited } from "@/lib/use-photo-urls";
import { useBoardLeaveWarning } from "@/lib/use-board-leave-warning";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { X } from "lucide-react";
export default function PhotoEditorDialog({
    imageId,
    external,
    onSaveExternal,
    onClose
}: {
    imageId?: number;
    external?: { url: string; presentation?: PhotoEdit | null };
    onSaveExternal?: (edit: PhotoEdit | null) => void;
    onClose: () => void;
}) {
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
        void (
            external
                ? Promise.resolve([{ edit: external.presentation ?? null, revision: 0 }, null] as const)
                : Promise.all([
                      readPhotoEdit(imageId!, controller.signal),
                      readOriginalPhoto(imageId!, controller.signal)
                  ])
        )
            .then(async ([saved, blob]) => {
                if (controller.signal.aborted) return;
                if (blob) resource.url = URL.createObjectURL(blob);
                const source = external?.url ?? resource.url!;
                const picture = new Image();
                picture.src = source;
                await picture.decode();
                if (controller.signal.aborted) return;
                const current = saved.edit ?? {
                    ...fullCrop,
                    ...outputSize(Math.min(1600, picture.naturalWidth), picture.naturalWidth / picture.naturalHeight)
                };
                setImage({ url: source, width: picture.naturalWidth, height: picture.naturalHeight });
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
    }, [imageId, external, retry]);
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
            if (external) onSaveExternal?.(reset ? null : edit);
            else {
                const saved = await savePhotoEdit(imageId!, revision, reset ? null : edit);
                photoWasEdited(imageId!, saved.revision);
            }
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
                <div className="fixed inset-0 z-[90]">
                    <ConfirmDialog
                        title="Discard photo edits?"
                        description="Your saved photo will keep its previous crop and size."
                        confirmLabel="Discard edits"
                        onCancel={() => setDiscard(false)}
                        onConfirm={onClose}
                    />
                </div>
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
                    className="bg-background text-foreground border-line max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-3xl border p-5 shadow-2xl sm:p-6"
                >
                    <header className="mb-3 flex items-center justify-between gap-4">
                        <h2 id="photo-editor-heading" className="font-display text-24 font-bold">
                            Edit photo
                        </h2>
                        <button
                            type="button"
                            disabled={busy}
                            aria-label="Close photo editor"
                            className="editor-icon-action border-line border"
                            onClick={close}
                        >
                            <X size={18} />
                        </button>
                    </header>
                    <p className="text-muted-foreground mb-3 text-xs leading-relaxed">
                        Drag to crop or use the controls below. Your original photo and location metadata are preserved.{" "}
                        {external
                            ? "Save stages this crop for this activity photo."
                            : "Saved edits apply wherever this upload is used."}
                    </p>
                    {image ? (
                        <>
                            <div
                                ref={stage}
                                className="relative mx-auto max-h-[42dvh] w-fit max-w-full overflow-hidden bg-black"
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
                                    className="block max-h-[42dvh] max-w-full select-none"
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
                            <fieldset
                                disabled={busy}
                                className="mt-4 grid items-center gap-x-5 gap-y-4 sm:grid-cols-3 sm:grid-rows-2"
                            >
                                <label className="text-xs sm:row-span-2">
                                    Aspect ratio
                                    <select
                                        aria-label="Photo aspect ratio"
                                        defaultValue="free"
                                        className="border-line hover:bg-faint mt-2 w-full cursor-pointer rounded-xl border p-3 transition-colors focus-visible:outline-2 disabled:cursor-default motion-reduce:transition-none"
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
                                            className="accent-foreground mt-3 block w-full cursor-pointer disabled:cursor-default"
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
                                    className="hover:text-muted-foreground ml-3 cursor-pointer underline focus-visible:outline-2"
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
                    <footer className="mt-5 flex flex-wrap justify-between gap-3">
                        <button
                            type="button"
                            disabled={busy || revision === null}
                            className="border-line hover:bg-faint cursor-pointer rounded-full border px-5 py-3 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-default disabled:opacity-40 motion-reduce:transition-none"
                            onClick={() => void save(true)}
                        >
                            Reset to original
                        </button>
                        <button
                            type="button"
                            disabled={busy || !image || revision === null}
                            className="bg-foreground text-background hover:bg-foreground/85 cursor-pointer rounded-full px-6 py-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-default disabled:opacity-40 motion-reduce:transition-none"
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
