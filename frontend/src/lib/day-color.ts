import { dayColors } from "@/types/board-creator";

export function dayColor(day: { color?: string | null }, index: number): string {
    const color = day.color ?? dayColors[index % dayColors.length];
    return `var(--day-${color.slice(1)}, ${color})`;
}
