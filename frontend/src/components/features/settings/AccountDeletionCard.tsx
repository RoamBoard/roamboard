"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { AccountDeletionError, deleteAccount } from "@/lib/auth";

export default function AccountDeletionCard({ disabled }: { disabled: boolean }) {
    const router = useRouter();
    const inFlight = useRef(false);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function confirmDelete() {
        if (inFlight.current) return;
        inFlight.current = true;
        setLoading(true);
        setError(null);
        try {
            await deleteAccount();
            router.replace("/");
            router.refresh();
        } catch (caught) {
            inFlight.current = false;
            setLoading(false);
            if (caught instanceof AccountDeletionError && caught.status === 401) {
                setOpen(false);
                router.replace("/login");
                return;
            }
            setError(caught instanceof Error ? caught.message : "Account deletion failed. Please try again.");
        }
    }

    return (
        <>
            <div className="border-line bg-background rounded-[2px] border p-6">
                <h2 className="font-display text-16 text-foreground font-bold tracking-tight uppercase">
                    Delete account
                </h2>
                <p className="text-12 text-muted-foreground mt-1 mb-5">
                    Permanently remove your account and the Boards and comments you created.
                </p>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                        setError(null);
                        setOpen(true);
                    }}
                    className="text-13 cursor-pointer rounded-[2px] border border-red-600 px-4 py-2.5 font-medium text-red-600 transition-colors hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Delete account
                </button>
            </div>
            {open && (
                <ConfirmDialog
                    title="Delete your account?"
                    description="This permanently deletes your profile, Boards, saved items and comments. Other people's comments and saves on your Boards will disappear. Boards they made by remixing yours will remain. Uploaded photos are removed from storage after they are no longer referenced. This cannot be undone."
                    confirmLabel="Delete account"
                    error={error}
                    loading={loading}
                    onCancel={() => {
                        if (!inFlight.current) setOpen(false);
                    }}
                    onConfirm={() => void confirmDelete()}
                />
            )}
        </>
    );
}
