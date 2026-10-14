"use client";

// Adapted from shadcn/ui's Command registry component (MIT, SHADCN-LICENSE.txt).
// Inline search needs no dialog; use the existing Roamboard theme tokens.
import { Command as Primitive } from "cmdk";
import { Search } from "lucide-react";
import type { ComponentProps } from "react";

export function Command({ className = "", ...props }: ComponentProps<typeof Primitive>) {
    return <Primitive className={`bg-background text-foreground flex w-full flex-col ${className}`} {...props} />;
}

export function CommandInput({
    className = "",
    "aria-expanded": expanded,
    ...props
}: ComponentProps<typeof Primitive.Input>) {
    // Slot merges cmdk's generated aria-controls with our actual popup state.
    const accessibility = { role: "combobox", "aria-expanded": expanded };
    return (
        <div className="border-line focus-within:border-foreground flex items-center gap-3 border-b">
            <Search size={18} aria-hidden="true" className="text-muted-foreground shrink-0" />
            <Primitive.Input
                asChild
                className={`placeholder:text-muted-foreground w-full min-w-0 bg-transparent py-5 text-base outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 ${className}`}
                {...props}
            >
                <input {...accessibility} />
            </Primitive.Input>
        </div>
    );
}

export function CommandList({ className = "", ...props }: ComponentProps<typeof Primitive.List>) {
    return (
        <Primitive.List
            className={`max-h-80 overflow-x-hidden overflow-y-auto overscroll-contain ${className}`}
            {...props}
        />
    );
}

export function CommandEmpty(props: ComponentProps<typeof Primitive.Empty>) {
    return <Primitive.Empty className="text-muted-foreground px-3 py-6 text-sm" {...props} />;
}

export function CommandGroup({ className = "", ...props }: ComponentProps<typeof Primitive.Group>) {
    return (
        <Primitive.Group
            className={`[&_[cmdk-group-heading]]:text-muted-foreground py-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:uppercase ${className}`}
            {...props}
        />
    );
}

export function CommandItem({ className = "", ...props }: ComponentProps<typeof Primitive.Item>) {
    return (
        <Primitive.Item
            className={`data-[selected=true]:bg-faint flex min-h-11 cursor-pointer items-center gap-3 px-3 py-3 text-sm outline-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 ${className}`}
            {...props}
        />
    );
}
