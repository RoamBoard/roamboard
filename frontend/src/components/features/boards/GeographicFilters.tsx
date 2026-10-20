"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { countries } from "@/lib/countries";
import pairs from "../../../../../shared/country-codes.json";
const continents = ["Africa", "Antarctica", "Asia", "Europe", "North America", "Oceania", "South America"];
const continentLabel = (value: string) =>
    continents.find((name) => name.toLowerCase().replaceAll(" ", "-") === value) ?? value;
const alpha2Codes = Object.fromEntries(Object.entries(pairs).map(([alpha2, alpha3]) => [alpha3, alpha2.toLowerCase()]));
type FilterKey = "countries" | "continents";
export default function GeographicFilters() {
    const params = useSearchParams() ?? new URLSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [open, setOpen] = useState<FilterKey | null>(null);
    const root = useRef<HTMLDivElement>(null);
    const id = useId();
    useEffect(() => {
        if (!open) return;
        const dismiss = (event: Event) => {
            const target = event.target;
            const active = root.current?.querySelector(`[data-filter="${open}"]`);
            if (target instanceof Node && !active?.contains(target)) setOpen(null);
        };
        document.addEventListener("pointerdown", dismiss);
        document.addEventListener("focusin", dismiss);
        return () => {
            document.removeEventListener("pointerdown", dismiss);
            document.removeEventListener("focusin", dismiss);
        };
    }, [open]);
    const update = (key: string, value?: string) => {
        const next = new URLSearchParams(params.toString());
        const values = next.getAll(key);
        next.delete(key);
        next.delete("page");
        if (value)
            [...new Set(values.includes(value) ? values.filter((item) => item !== value) : [...values, value])].forEach(
                (item) => next.append(key, item)
            );
        else {
            next.delete("countries");
            next.delete("continents");
        }
        router.replace(pathname + (next.size ? "?" + next : ""), { scroll: false });
    };
    const navigate = (event: KeyboardEvent<HTMLDetailsElement>) => {
        // Filter keyboard actions must never reach page/gallery shortcuts or scroll the page.
        event.stopPropagation();
        if (event.key === "Escape") {
            event.preventDefault();
            setOpen(null);
            event.currentTarget.querySelector("summary")?.focus({ preventScroll: true });
            return;
        }
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        const typing = event.target instanceof HTMLInputElement && event.target.type !== "checkbox";
        if (typing && ["Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const key = event.currentTarget.dataset.filter as FilterKey;
        setOpen(key);
        const options = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
        const current = options.indexOf(event.target as HTMLInputElement);
        const next =
            event.key === "Home"
                ? 0
                : event.key === "End"
                  ? options.length - 1
                  : current < 0
                    ? event.key === "ArrowUp"
                        ? options.length - 1
                        : 0
                    : Math.max(0, Math.min(options.length - 1, current + (event.key === "ArrowDown" ? 1 : -1)));
        // Opening a closed details element takes effect after this event.
        requestAnimationFrame(() => {
            options[next]?.focus({ preventScroll: true });
            const row = options[next]?.closest("label");
            const list = row?.parentElement;
            if (row && list) {
                const rowBounds = row.getBoundingClientRect();
                const listBounds = list.getBoundingClientRect();
                if (rowBounds.bottom > listBounds.bottom) list.scrollTop += rowBounds.bottom - listBounds.bottom;
                else if (rowBounds.top < listBounds.top) list.scrollTop += rowBounds.top - listBounds.top;
            }
        });
    };
    return (
        <div ref={root} className="flex flex-wrap items-start gap-3 text-left text-sm">
            {(["countries", "continents"] as const).map((key) => (
                <details key={key} data-filter={key} open={open === key} className="relative" onKeyDown={navigate}>
                    <summary
                        aria-controls={`${id}-${key}`}
                        aria-expanded={open === key}
                        onClick={(event) => {
                            event.preventDefault();
                            setOpen(open === key ? null : key);
                        }}
                        className="border-line min-h-11 cursor-pointer border px-3 py-3 focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                        {key === "countries" ? "Countries" : "Continents"} ({params.getAll(key).length})
                    </summary>
                    <div
                        id={`${id}-${key}`}
                        className="bg-background border-line absolute top-full left-0 z-50 flex h-84 w-72 max-w-[calc(100vw-2.5rem)] flex-col border p-3 shadow-xl"
                    >
                        {key === "countries" && (
                            <input
                                aria-label="Find countries"
                                placeholder="Find countries"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                className="border-line mb-2 min-h-11 w-full shrink-0 border bg-transparent px-2"
                            />
                        )}
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                            {(key === "countries"
                                ? countries
                                      .filter(
                                          (country) =>
                                              country.name.toLowerCase().includes(search.toLowerCase()) ||
                                              country.code.toLowerCase().includes(search.toLowerCase())
                                      )
                                      .map((country) => ({ value: country.code, label: country.name }))
                                : continents.map((name) => ({
                                      value: name.toLowerCase().replaceAll(" ", "-"),
                                      label: name
                                  }))
                            ).map((option) => (
                                <label
                                    key={option.value}
                                    className="hover:bg-foreground/5 flex min-h-11 cursor-pointer items-center gap-2 px-1"
                                >
                                    <input
                                        type="checkbox"
                                        checked={params.getAll(key).includes(option.value)}
                                        onChange={() => update(key, option.value)}
                                        className="shrink-0"
                                    />
                                    {key === "countries" && (
                                        <Image
                                            src={`/flags/${alpha2Codes[option.value]}.svg`}
                                            alt=""
                                            width={20}
                                            height={15}
                                            className="h-[15px] w-5 shrink-0 object-contain"
                                            unoptimized
                                        />
                                    )}
                                    <span className="min-w-0 flex-1">{option.label}</span>
                                    {key === "countries" && (
                                        <span className="text-muted-foreground shrink-0 text-xs">{option.value}</span>
                                    )}
                                </label>
                            ))}
                            {key === "countries" &&
                                !countries.some(
                                    (country) =>
                                        country.name.toLowerCase().includes(search.toLowerCase()) ||
                                        country.code.toLowerCase().includes(search.toLowerCase())
                                ) && (
                                    <p role="status" className="py-3">
                                        No countries found.
                                    </p>
                                )}
                        </div>
                    </div>
                </details>
            ))}
            {(params.has("countries") || params.has("continents")) && (
                <button type="button" className="min-h-11 px-2 underline" onClick={() => update("countries")}>
                    Clear filters
                </button>
            )}
            <div className="flex flex-wrap gap-2">
                {(["countries", "continents"] as const).flatMap((key) =>
                    params.getAll(key).map((value) => (
                        <button
                            key={key + value}
                            type="button"
                            className="border-line min-h-11 border px-2"
                            aria-label={"Remove " + value}
                            onClick={() => update(key, value)}
                        >
                            {key === "continents"
                                ? continentLabel(value)
                                : (countries.find((country) => country.code === value)?.name ?? value)}{" "}
                            {"\u00d7"}
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
export function geographicQuery(params: { getAll(key: string): string[] }) {
    const query = new URLSearchParams();
    for (const key of ["countries", "continents"]) for (const value of params.getAll(key)) query.append(key, value);
    return query.toString();
}
