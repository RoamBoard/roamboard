"use client";
import { useRef } from "react";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import type { SmartCreatePlan } from "@/lib/smart-create";

export default function SmartCreateReviewDialog({
    plan,
    onConfirm,
    onCancel
}: {
    plan: SmartCreatePlan;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    const dialogRef = useRef<HTMLDivElement>(null);
    useDialogFocus(dialogRef, onCancel);
    return (
        <div
            role="presentation"
            className="fixed inset-0 z-[60] grid place-items-center bg-black/45 p-4"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onCancel();
            }}
        >
            <div
                ref={dialogRef}
                tabIndex={-1}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="smart-review-title"
                aria-describedby="smart-review-description"
                className="bg-background max-h-[85svh] w-full max-w-xl overflow-y-auto p-6 shadow-2xl outline-none sm:p-8"
            >
                <h2 id="smart-review-title" className="font-display text-24 font-bold">
                    Earlier photos found
                </h2>
                <p id="smart-review-description" className="text-muted-foreground mt-3 text-sm leading-relaxed">
                    These photos start earlier than your current plan. Existing days will move forward by{" "}
                    {plan.shiftDays} {plan.shiftDays === 1 ? "day" : "days"}. Activity titles, times, covers, and other
                    edits stay as you set them for activities kept in the plan.
                </p>
                {plan.removedTitles.length ? (
                    <p className="mt-4 text-sm">
                        Beyond Day 31: {plan.removedTitles.join(", ")}. These activities will leave the plan, but their
                        photos stay uploaded.
                    </p>
                ) : null}
                {plan.warnings.map((warning) => (
                    <p key={warning} className="text-muted-foreground mt-3 text-xs">
                        {warning}
                    </p>
                ))}
                <ol aria-label="Proposed day plan" className="border-line mt-5 max-h-64 overflow-y-auto border-y py-2">
                    {plan.days.map((day) => (
                        <li key={day.id} className="py-2 text-sm">
                            <strong>Day {day.dayNumber}</strong>
                            <span className="text-muted-foreground">
                                {" "}
                                - {day.pins.length ? day.pins.map((pin) => pin.title).join(", ") : "No activities yet"}
                            </span>
                        </li>
                    ))}
                </ol>
                <p className="text-muted-foreground mt-3 text-xs">
                    Keep your current plan to leave the new photos available for manual assignment.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="border-line min-h-11 border px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-4"
                    >
                        Keep current plan
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="bg-foreground text-background min-h-11 px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-4"
                    >
                        Use revised plan
                    </button>
                </div>
            </div>
        </div>
    );
}
