"use client";

import { Toaster } from "sonner";
import type { CSSProperties } from "react";

export const creatorToastOptions = { toasterId: "board-creator" };

export default function CreatorNotifications() {
    return (
        <Toaster
            id="board-creator"
            position="bottom-right"
            closeButton
            visibleToasts={2}
            duration={5500}
            containerAriaLabel="Board notifications"
            style={
                {
                    left: "auto",
                    right: 16,
                    width: "min(356px, calc(100vw - 112px))",
                    fontFamily: "var(--font-body)",
                    "--normal-bg": "var(--background)",
                    "--normal-text": "var(--foreground)",
                    "--normal-border": "var(--line)"
                } as CSSProperties
            }
            toastOptions={{
                style: {
                    width: "100%",
                    background: "var(--background)",
                    color: "var(--foreground)",
                    borderColor: "var(--line)",
                    fontFamily: "var(--font-body)"
                }
            }}
        />
    );
}
