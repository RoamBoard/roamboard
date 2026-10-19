"use client";

import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { BoardLeaveNavigation } from "@/lib/board-editor-safety";

export default function CreatorLeaveDialog({
    href,
    navigation = "push",
    onClose
}: {
    href: string;
    navigation?: BoardLeaveNavigation;
    onClose: () => void;
}) {
    const router = useRouter();
    return (
        <ConfirmDialog
            title="Leave this Board?"
            description="Unsaved changes or uploads may be lost. Cancel to keep editing and save first."
            confirmLabel="Leave without saving"
            onCancel={onClose}
            onConfirm={() => {
                onClose();
                if (navigation === "back") {
                    router.back();
                    return;
                }
                const destination = new URL(href);
                const target = `${destination.pathname}${destination.search}${destination.hash}`;
                if (navigation === "replace") router.replace(target);
                else router.push(target);
            }}
        />
    );
}
