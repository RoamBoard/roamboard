import { useEffect, useRef, type RefObject } from "react";

const focusableSelector =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDialogFocus<T extends HTMLElement>(containerRef: RefObject<T | null>, onClose?: () => void) {
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        const previousActive = document.activeElement as HTMLElement | null;

        const focusInitial = () => {
            if (!containerRef.current) return;
            const focusables = Array.from(containerRef.current.querySelectorAll<HTMLElement>(focusableSelector)).filter(
                (el) => el.offsetParent !== null || el.getClientRects().length > 0
            );

            if (focusables.length > 0) {
                focusables[0].focus();
            } else {
                containerRef.current.focus();
            }
        };

        const timer = setTimeout(focusInitial, 0);

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                onCloseRef.current?.();
                return;
            }

            if (event.key === "Tab" && containerRef.current) {
                const focusables = Array.from(
                    containerRef.current.querySelectorAll<HTMLElement>(focusableSelector)
                ).filter((el) => el.offsetParent !== null || el.getClientRects().length > 0);

                if (focusables.length === 0) {
                    event.preventDefault();
                    return;
                }

                const first = focusables[0];
                const last = focusables[focusables.length - 1];

                if (event.shiftKey) {
                    if (document.activeElement === first || !containerRef.current.contains(document.activeElement)) {
                        event.preventDefault();
                        last.focus();
                    }
                } else {
                    if (document.activeElement === last || !containerRef.current.contains(document.activeElement)) {
                        event.preventDefault();
                        first.focus();
                    }
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            clearTimeout(timer);
            window.removeEventListener("keydown", handleKeyDown);
            if (previousActive && typeof previousActive.focus === "function") {
                previousActive.focus();
            }
        };
    }, [containerRef]);
}
