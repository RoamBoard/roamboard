"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { fitDestinationHeading } from "@/lib/destination-heading";

export default function DestinationHeading({ name, country }: { name: string; country: string }) {
    const frame = useRef<HTMLDivElement>(null);
    const label = useRef<HTMLParagraphElement>(null);
    const heading = useRef<HTMLHeadingElement>(null);
    const [fit, setFit] = useState<ReturnType<typeof fitDestinationHeading> | null>(null);

    useLayoutEffect(() => {
        const box = frame.current;
        const title = heading.current;
        const eyebrow = label.current;
        if (!box || !title || !eyebrow) return;
        const context = document.createElement("canvas").getContext("2d");
        if (!context) return;
        const lifecycle = { active: true, pending: 0 };
        const widths = new Map<string, number>();
        const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
        const nativeTracking = "letterSpacing" in context;
        const measure = (text: string) => {
            const cached = widths.get(text);
            if (cached !== undefined) return cached;
            const width =
                context.measureText(text).width -
                (nativeTracking ? 0 : Array.from(segmenter.segment(text)).length * 6.5);
            widths.set(text, width);
            return width;
        };
        const refit = () => {
            if (!lifecycle.active || !box.clientWidth || !box.clientHeight) return;
            const style = window.getComputedStyle(title);
            context.font = `${style.fontStyle} ${style.fontWeight} 100px ${style.fontFamily}`;
            if (nativeTracking) context.letterSpacing = "-6.5px";
            const next = fitDestinationHeading(
                name,
                box.clientWidth,
                box.clientHeight - eyebrow.offsetHeight - 8,
                measure
            );
            setFit((previous) =>
                next.fontSize <= 0
                    ? null
                    : previous?.fontSize === next.fontSize && previous.lines.join("\n") === next.lines.join("\n")
                      ? previous
                      : next
            );
        };
        const schedule = () => {
            if (!lifecycle.active) return;
            cancelAnimationFrame(lifecycle.pending);
            lifecycle.pending = requestAnimationFrame(refit);
        };
        const fontChanged = () => {
            widths.clear();
            schedule();
        };
        refit();
        const observer = new ResizeObserver(schedule);
        observer.observe(box);
        void document.fonts.ready.then(() => {
            if (lifecycle.active) fontChanged();
        });
        document.fonts.addEventListener("loadingdone", fontChanged);
        return () => {
            lifecycle.active = false;
            observer.disconnect();
            cancelAnimationFrame(lifecycle.pending);
            document.fonts.removeEventListener("loadingdone", fontChanged);
        };
    }, [name, country]);

    return (
        <div
            ref={frame}
            data-destination-type-frame
            className="absolute top-1/2 right-[42%] left-5 flex h-[min(max(3rem,calc(100%_-_8rem)),42cqw)] -translate-y-1/2 flex-col justify-center md:left-8"
        >
            <p ref={label} className="mb-2 shrink-0 text-xs leading-4 tracking-widest uppercase">
                {country}
            </p>
            <h1
                ref={heading}
                aria-label={name}
                style={fit ? { fontSize: fit.fontSize } : undefined}
                className="font-display text-[clamp(1rem,7cqw,6rem)] leading-[0.9] font-bold tracking-[-0.065em] [text-wrap:balance] [overflow-wrap:anywhere] uppercase"
            >
                {fit
                    ? fit.lines.map((line, index) => (
                          <span className="block whitespace-nowrap" key={index}>
                              {line}
                          </span>
                      ))
                    : name}
            </h1>
        </div>
    );
}
