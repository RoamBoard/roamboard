"use client";

import type { ComponentProps } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

// Copied and adapted from shadcn/ui's New York dropdown (MIT, see SHADCN-LICENSE.txt):
// https://ui.shadcn.com/r/styles/new-york-v4/dropdown-menu.json
// Shared by ThemeSelect and ProfileControl. Colors use Roamboard's existing tokens;
// the selected dot uses CSS, and the Radix dropdown package is imported directly.

function DropdownMenu({
    ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Root>) {
    return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger({
    ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
    return (
        <DropdownMenuPrimitive.Trigger
            data-slot="dropdown-menu-trigger"
            {...props}
        />
    );
}

function DropdownMenuContent({
    className,
    sideOffset = 4,
    ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
    return (
        // A portal renders the popup outside page containers that could clip it.
        <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.Content
                data-slot="dropdown-menu-content"
                sideOffset={sideOffset}
                className={`font-body bg-background text-foreground border-line z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-32 overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md ${className ?? ""}`}
                {...props}
            />
        </DropdownMenuPrimitive.Portal>
    );
}

function DropdownMenuItem({
    className,
    ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Item>) {
    return (
        <DropdownMenuPrimitive.Item
            data-slot="dropdown-menu-item"
            className={`focus:bg-faint focus:text-foreground relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${className ?? ""}`}
            {...props}
        />
    );
}

function DropdownMenuRadioGroup({
    ...props
}: ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
    return (
        <DropdownMenuPrimitive.RadioGroup
            data-slot="dropdown-menu-radio-group"
            {...props}
        />
    );
}

function DropdownMenuRadioItem({
    className,
    children,
    ...props
}: ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
    return (
        <DropdownMenuPrimitive.RadioItem
            data-slot="dropdown-menu-radio-item"
            className={`focus:bg-faint focus:text-foreground relative flex cursor-pointer items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${className ?? ""}`}
            {...props}
        >
            <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
                {/* Radix displays the indicator only for the selected radio option. */}
                <DropdownMenuPrimitive.ItemIndicator>
                    <span className="block size-2 rounded-full bg-current" />
                </DropdownMenuPrimitive.ItemIndicator>
            </span>
            {children}
        </DropdownMenuPrimitive.RadioItem>
    );
}

function DropdownMenuSeparator({
    className,
    ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
    return (
        <DropdownMenuPrimitive.Separator
            data-slot="dropdown-menu-separator"
            className={`bg-line -mx-1 my-1 h-px ${className ?? ""}`}
            {...props}
        />
    );
}

export {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator
};

