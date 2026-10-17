"use client";

import { useEffect } from "react";
import { shouldConfirmBoardNavigation } from "./board-editor-safety";

export function useBoardLeaveWarning(active: boolean, onLeaveRequest?: (href: string) => void) {
    useEffect(() => {
        if (!active) return;
        function beforeUnload(event: BeforeUnloadEvent) {
            event.preventDefault();
            event.returnValue = "";
        }
        function beforeLink(event: MouseEvent) {
            const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
            if (!(anchor instanceof HTMLAnchorElement) || !onLeaveRequest) return;
            if (
                !shouldConfirmBoardNavigation(
                    event,
                    { href: anchor.href, target: anchor.target, download: anchor.hasAttribute("download") },
                    window.location.href
                )
            )
                return;
            event.preventDefault();
            event.stopImmediatePropagation();
            onLeaveRequest(anchor.href);
        }
        window.addEventListener("beforeunload", beforeUnload);
        if (onLeaveRequest) document.addEventListener("click", beforeLink, true);
        return () => {
            window.removeEventListener("beforeunload", beforeUnload);
            document.removeEventListener("click", beforeLink, true);
        };
    }, [active, onLeaveRequest]);
}
