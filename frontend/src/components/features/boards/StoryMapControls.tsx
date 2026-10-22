"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

export default function StoryMapControls({ map }: { map: ReactNode }) {
    const anchor = useRef<HTMLDivElement>(null);
    const button = useRef<HTMLButtonElement>(null);
    const [expanded, setExpanded] = useState(false);
    const [size, setSize] = useState<{ width: number; height: number }>();
    useEffect(() => {
        if (!expanded || !anchor.current) return;
        const node = anchor.current;
        const scene = node.closest<HTMLElement>("[data-story-scene]");
        if (!scene) return;
        const obscured: Array<{ node: HTMLElement; inert: boolean }> = [];
        const restore = () => {
            for (const item of obscured) {
                delete item.node.dataset.storyMapObscured;
                item.node.inert = item.inert;
            }
            obscured.length = 0;
        };
        const measure = () => {
            const origin = node.getBoundingClientRect();
            const bounds = scene.getBoundingClientRect();
            const width = Math.max(origin.width, Math.min(bounds.right - origin.left - 24, bounds.width * 0.6));
            const height = Math.max(
                origin.height,
                Math.min(origin.bottom - Math.max(bounds.top, 62) - 24, bounds.height * 0.8)
            );
            setSize({ width, height });
            restore();
            // Leave the same map mounted; fade only scene elements its expanded bounds cover.
            const collect = (current: HTMLElement) => {
                if (current === node) return;
                for (const child of current.children) {
                    if (!(child instanceof HTMLElement)) continue;
                    if (child.contains(node)) collect(child);
                    else {
                        const rect = child.getBoundingClientRect();
                        if (
                            rect.right <= origin.left ||
                            rect.left >= origin.left + width ||
                            rect.bottom <= origin.bottom - height ||
                            rect.top >= origin.bottom
                        )
                            continue;
                        obscured.push({ node: child, inert: child.inert });
                        const direction = rect.left + rect.width / 2 < origin.left + width / 2 ? -1 : 1;
                        child.style.setProperty("--story-map-escape-x", `${direction * 64}px`);
                        child.style.setProperty("--story-map-escape-rotate", `${direction * 2}deg`);
                        child.classList.add("story-map-obscurable");
                        child.dataset.storyMapObscured = "true";
                        child.inert = true;
                    }
                }
            };
            collect(scene);
        };
        const close = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            setExpanded(false);
            button.current?.focus({ preventScroll: true });
        };
        const collapse = () => setExpanded(false);
        window.addEventListener("story-map-collapse", collapse);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(scene);
        window.addEventListener("keydown", close);
        return () => {
            window.removeEventListener("story-map-collapse", collapse);
            observer.disconnect();
            window.removeEventListener("keydown", close);
            restore();
        };
    }, [expanded]);
    return (
        <div
            ref={anchor}
            aria-label="Journey map"
            className={`relative aspect-square w-full max-w-96 ${expanded ? "z-40" : ""}`}
        >
            <div
                data-story-map-expanded={expanded}
                className="bg-background absolute bottom-0 left-0 h-full w-full transition-[width,height,box-shadow] duration-300 ease-out motion-reduce:transition-none"
                style={expanded && size ? { width: size.width, height: size.height } : undefined}
            >
                {map}
                <button
                    ref={button}
                    type="button"
                    aria-label={expanded ? "Collapse journey map" : "Enlarge journey map"}
                    aria-expanded={expanded}
                    onClick={() => setExpanded((current) => !current)}
                    className="bg-background/90 hover:bg-faint absolute top-2 left-2 z-10 grid size-11 place-items-center rounded-full shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                    {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
            </div>
        </div>
    );
}
