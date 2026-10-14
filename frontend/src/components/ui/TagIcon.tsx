"use client";

import { DynamicIcon, iconNames, type IconName } from "lucide-react/dynamic";
import type { BoardTag } from "@/data/board-tags";

type Props = { tag: BoardTag; className?: string; size?: number };

export default function TagIcon({ tag, className, size = 20 }: Props) {
    // The catalog's pinned SVG filename is Lucide's canonical kebab-case key.
    // This keeps new catalog icons available without a second hand-maintained map.
    const name = new URL(tag.icon.svgUrl).pathname
        .split("/")
        .pop()
        ?.replace(/\.svg$/, "");
    if (!name || !iconNames.includes(name as IconName)) {
        return <span aria-hidden="true" className={className} style={{ width: size, height: size }} />;
    }
    return (
        <DynamicIcon
            name={name as IconName}
            size={size}
            strokeWidth={1.6}
            aria-hidden="true"
            className={className}
            fallback={() => <span aria-hidden="true" style={{ width: size, height: size }} />}
        />
    );
}
