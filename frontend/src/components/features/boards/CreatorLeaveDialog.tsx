"use client";

import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

export default function CreatorLeaveDialog({ href, onClose }: { href: string; onClose: () => void }) {
    const router = useRouter();
    return (
        <ConfirmDialog
            title="Leave this Board?"
            description="Unsaved changes or uploads may be lost. Cancel to keep editing and save first."
            confirmLabel="Leave without saving"
            onCancel={onClose}
            onConfirm={() => {
                const destination = new URL(href);
                onClose();
                router.push(`${destination.pathname}${destination.search}${destination.hash}`);
            }}
        />
    );
}
