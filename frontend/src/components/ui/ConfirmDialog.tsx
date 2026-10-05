"use client";

type Props = {
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmDialog({ title, description, confirmLabel, onCancel, onConfirm }: Props) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description" className="w-full max-w-md bg-background p-7 shadow-2xl">
        <h2 id="confirm-title" className="font-display text-30 font-bold">{title}</h2>
        <p id="confirm-description" className="mt-3 text-14 leading-6 text-graphite">{description}</p>
        <div className="mt-7 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="border border-line px-5 py-3 text-13">Cancel</button>
          <button type="button" onClick={onConfirm} className="border border-foreground bg-foreground px-5 py-3 text-13 text-background">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
