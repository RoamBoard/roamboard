"use client";

import PinCategoryIcon from "@/components/ui/PinCategoryIcon";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem
} from "@/components/ui/dropdown-menu";
import { pinCategories } from "@/lib/board-options";
import type { BoardPinDraft, PinCategory } from "@/types/board-creator";

export default function ActivityCategoryPicker({
    pin,
    disabled,
    onChange
}: {
    pin: BoardPinDraft;
    disabled: boolean;
    onChange: (category: PinCategory) => void;
}) {
    const label = pinCategories.find((item) => item.value === pin.category)?.label ?? pin.category;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    aria-label={`Change category for ${pin.title}: ${label}`}
                    title={`${label} · change category`}
                    className="group absolute top-1/2 -left-5 z-10 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed"
                >
                    <span className="border-line bg-background text-muted-foreground group-hover:border-foreground group-hover:text-foreground grid size-6 place-items-center rounded-full border transition-colors motion-reduce:transition-none">
                        <PinCategoryIcon category={pin.category} className="size-3.5" />
                    </span>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="start"
                sideOffset={0}
                collisionPadding={12}
                className="w-56 rounded-none p-2"
                aria-label={`Activity category for ${pin.title}`}
            >
                <p className="text-muted-foreground px-3 pt-2 pb-3 text-xs">Activity category · type to jump</p>
                <DropdownMenuRadioGroup
                    value={pin.category}
                    onValueChange={(value) => {
                        const category = pinCategories.find((item) => item.value === value);
                        if (!disabled && category) onChange(category.value);
                    }}
                >
                    {pinCategories.map((item) => (
                        <DropdownMenuRadioItem
                            key={item.value}
                            value={item.value}
                            textValue={item.label}
                            className="min-h-11 gap-3 rounded-none"
                        >
                            <PinCategoryIcon category={item.value} className="size-4" />
                            {item.label}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
