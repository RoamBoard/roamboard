"use client";

import { useEffect, useRef } from "react";

type Props = {
    username: string;
};

export default function WelcomeUsername({ username }: Props) {
    const nameRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const name = nameRef.current;
        if (!name) return;

        // Measure the actual typeface so long names fit within two lines.
        function fitName() {
            if (!name) return;
            name.style.fontSize = "";
            const fullSize = Number.parseFloat(getComputedStyle(name).fontSize);

            for (const step of Array.from(
                { length: 40 },
                (_, index) => index
            )) {
                const size = fullSize * (1 - step / 45);
                name.style.fontSize = `${size}px`;
                if (name.scrollHeight <= size * 2 + 1) return;
            }
        }

        const observer = new ResizeObserver(fitName);
        const container = name.parentElement;
        if (container) observer.observe(container);
        fitName();

        const controller = new AbortController();
        void document.fonts.ready.then(() => {
            if (!controller.signal.aborted) fitName();
        });

        return () => {
            observer.disconnect();
            controller.abort();
        };
    }, [username]);

    return (
        <span
            ref={nameRef}
            className="absolute top-[13.8%] left-[44.75%] z-2 max-h-[2em] w-[33%] overflow-hidden text-[length:min(8.7cqw,13.46cqh)] leading-none font-normal [overflow-wrap:anywhere] text-white uppercase"
        >
            {username}
        </span>
    );
}
