"use client";

import Link from "next/link";
import { useRef } from "react";
import { useWelcomeTransition } from "./WelcomeTransitionProvider";

export default function EnterTransition() {
    const { entering, enter } = useWelcomeTransition();
    const linkRef = useRef<HTMLAnchorElement>(null);

    return (
        <Link
            href="/home"
            ref={linkRef}
            className="focus-visible:outline-obsidian absolute top-[40.3%] right-0 z-3 flex h-[14.3%] w-[max(13.7%,5.5rem)] items-center overflow-hidden bg-black pl-[3.5vw] text-[length:clamp(1.125rem,3.2vw,5rem)] leading-none text-white focus-visible:outline-2 focus-visible:outline-offset-5"
            aria-label="Enter Roamboard"
            aria-disabled={entering}
            onNavigate={(event) => {
                event.preventDefault();
                enter(linkRef.current);
            }}
        >
            ENTER
        </Link>
    );
}
