"use client";

import { useState } from "react";
import DestinationArtwork from "./DestinationArtwork";
import type { DestinationGuideData } from "@/lib/destination-guides";

const names = [
    "Stockholm",
    "Kyoto",
    "San Sebastián",
    "Buenos Aires",
    "Llanfairpwllgwyngyll",
    "San Cristóbal de las Casas",
    "東京",
    "São Tomé and Príncipe",
    "WWWWWWWW",
    "IIIIIIII"
];

// The same existing Stockholm provider photo is illustrative for every local name; no destination records are created.
const image: DestinationGuideData["images"][number] = {
    id: "typography-stockholm-fixture",
    url: "https://images.unsplash.com/photo-1509356843151-3e7d96241e11?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMDg0ODQ0fDB8MXxzZWFyY2h8MXx8U3RvY2tob2xtJTIwU3dlZGVufGVufDB8MHx8fDE3OTI0NjEzMDB8MA&ixlib=rb-4.1.0&q=85&w=3200&auto=format",
    thumbnailUrl: "https://images.unsplash.com/photo-1509356843151-3e7d96241e11?w=400&auto=format",
    alt: "Illustrative Stockholm waterfront photograph reused for local typography fixtures",
    photographer: "Raphael Andres",
    photographerUrl: "https://unsplash.com/@raphaeldas",
    sourceUrl: "https://unsplash.com/photos/riddarholmen-church-spire-in-stockholm-3cwvFD-YPtk",
    width: 3200,
    height: 2134
};

export default function DestinationTypographyLab() {
    const [name, setName] = useState(names[0]);
    return (
        <div className="bg-background text-foreground grid h-dvh min-w-0 grid-rows-[minmax(10rem,38%)_minmax(0,1fr)] overflow-hidden md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:grid-rows-1">
            <DestinationArtwork name={name} country="Local fixture" image={image} />
            <section className="font-body flex min-h-0 flex-col overflow-y-auto px-6 py-6 md:justify-center md:px-10 [&>*]:shrink-0">
                <h2 className="font-display text-2xl">Destination typography review</h2>
                <p className="text-muted-foreground mt-4 text-sm leading-6">
                    Local fixtures using the production artwork and heading. The Stockholm photo is illustrative; these
                    controls do not load or save destination records.
                </p>
                <label className="mt-5 text-sm" htmlFor="typography-example">
                    Example name
                </label>
                <select
                    id="typography-example"
                    className="border-line bg-background mt-2 min-h-11 w-full border px-2 text-sm"
                    value={names.includes(name) ? name : ""}
                    onChange={(event) => setName(event.target.value)}
                >
                    <option value="" disabled>
                        Custom text
                    </option>
                    {names.map((value) => (
                        <option key={value}>{value}</option>
                    ))}
                </select>
                <label className="mt-5 text-sm" htmlFor="typography-custom">
                    Custom name (local only)
                </label>
                <input
                    id="typography-custom"
                    className="border-line mt-2 min-h-11 min-w-0 border px-3 text-base"
                    maxLength={100}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                />
            </section>
        </div>
    );
}
