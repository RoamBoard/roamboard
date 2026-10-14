"use client";

import { useState } from "react";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem
} from "@/components/ui/dropdown-menu";

// Uses shadcn/ui's actual dropdown component, adapted to our colors and icons:
// https://ui.shadcn.com/docs/components/radix/dropdown-menu

type Props = {
    // Bottom-of-page controls open upward so the menu stays on screen.
    side?: "top" | "bottom";
};

export default function ThemeSelect({ side = "bottom" }: Props) {
    // This state marks the selected option. The component manages opening and focus.
    const [selectedTheme, setSelectedTheme] = useState(() =>
        typeof document !== "undefined" &&
        document.documentElement.classList.contains("dark")
            ? "dark"
            : "light"
    );

    const selectTheme = (theme: string) => {
        if (theme !== "light" && theme !== "dark") return;

        // The root class changes the whole site's colors. layout.tsx restores it on load.
        document.documentElement.classList.toggle("dark", theme === "dark");
        setSelectedTheme(theme);
        try {
            localStorage.setItem("roamboard-theme", theme);
        } catch {
            // Switching still works for this visit without storage.
        }
    };

    const options = (
        <DropdownMenuRadioGroup
            value={selectedTheme}
            onValueChange={selectTheme}
        >
            <DropdownMenuRadioItem value="light">
                <span
                    aria-hidden="true"
                    className="size-4 shrink-0 bg-current mask-[url('/icons/sun.svg')] mask-contain mask-center mask-no-repeat"
                />
                light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
                <span
                    aria-hidden="true"
                    className="size-4 shrink-0 bg-current mask-[url('/icons/moon.svg')] mask-contain mask-center mask-no-repeat"
                />
                dark
            </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
    );

    return (
        <DropdownMenu
            modal={false}
            onOpenChange={(open) => {
                // Read the current theme when opening, including after page navigation.
                if (open) {
                    setSelectedTheme(
                        document.documentElement.classList.contains("dark")
                            ? "dark"
                            : "light"
                    );
                }
            }}
        >
            {/* asChild gives our button the dropdown's keyboard and click behavior. */}
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label="Color theme"
                    className="font-body text-12 text-muted-foreground hover:text-foreground focus-visible:text-foreground inline-flex min-h-9 cursor-pointer items-center gap-2 border-0 bg-transparent py-2 pr-1 underline-offset-2 outline-none hover:underline focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
                >
                    <span
                        aria-hidden="true"
                        className="size-4 bg-current mask-[url('/icons/sun.svg')] mask-contain mask-center mask-no-repeat dark:mask-[url('/icons/moon.svg')]"
                    />
                    {/* CSS keeps this label in sync before React mounts as well. */}
                    <span className="dark:hidden">light</span>
                    <span className="hidden dark:inline">dark</span>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                aria-label="Color theme options"
                align="end"
                side={side}
                sideOffset={8}
                collisionPadding={8}
            >
                {options}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
