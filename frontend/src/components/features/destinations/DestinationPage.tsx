"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { motion, MotionConfig, useReducedMotion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { destinationPages, destinationPageHref, type DestinationPageData } from "@/data/destination-atlas";
import AtlasPhoto from "./AtlasPhoto";
import { DestinationAtlas } from "./DestinationAtlas";
import { DestinationRail } from "./DestinationRail";
import { DestinationStories } from "./DestinationStories";

function DestinationSeasons({ destination }: { destination: DestinationPageData }) {
    const [season, setSeason] = useState(0);
    const reduced = useReducedMotion();
    const selected = destination.seasons[season];
    return (
        <aside
            id="destination-seasons"
            aria-labelledby="destination-seasons-heading"
            className="bg-background border-line relative flex h-full w-[var(--destination-width)] shrink-0 flex-col overflow-y-auto border-x px-7 py-10 md:w-[clamp(420px,43vw,620px)] md:px-12 md:py-12"
        >
            <p className="text-muted-foreground border-line border-t pt-4 text-[10px] tracking-[0.18em] uppercase">
                The city, in season
            </p>
            <h2
                id="destination-seasons-heading"
                className="font-display mt-10 text-[clamp(3rem,5vw,5rem)] leading-[0.9] tracking-[-0.05em]"
            >
                When
                <br />
                to go.
            </h2>
            <div className="border-line my-auto border-y py-7">
                <div
                    className="border-line grid grid-cols-3 divide-x border-b"
                    aria-label="Explore destination seasons"
                >
                    {destination.seasons.map((item, index) => (
                        <button
                            key={item.months}
                            type="button"
                            aria-pressed={season === index}
                            aria-controls="destination-season-note"
                            onClick={() => setSeason(index)}
                            className={`min-h-12 border-b px-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 ${season === index ? "border-foreground" : "text-muted-foreground border-transparent"}`}
                        >
                            {item.months}
                        </button>
                    ))}
                </div>
                <motion.div
                    key={selected.months}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: reduced ? 0 : 0.35 }}
                >
                    <p className="font-display mt-7 text-[clamp(2rem,3vw,3rem)] leading-[1.02] tracking-tight">
                        {selected.title}.
                    </p>
                </motion.div>
                <p
                    id="destination-season-note"
                    aria-live="polite"
                    className="text-muted-foreground mt-4 max-w-[32ch] text-sm leading-7"
                >
                    <span className="sr-only">{selected.title}. </span>
                    {selected.description}
                </p>
            </div>
        </aside>
    );
}

export function DestinationPage({ destination }: { destination: DestinationPageData }) {
    const reduced = useReducedMotion();
    const graphic = destination.composition === "graphic";
    const paragraphs = destination.opening?.paragraphs ?? [destination.culture.text];
    const pins = destination.opening?.pins ?? destination.places.map((place) => `${place.name} - ${place.caption}`);
    const tags = destination.opening?.tags ?? Array.from(new Set(destination.places.map((place) => place.category)));
    return (
        <MotionConfig reducedMotion="user">
            <DestinationRail
                name={destination.name}
                credits={
                    <>
                        <div className="flex flex-wrap items-baseline justify-between gap-5">
                            <p className="text-xs">Somewhere else on your mind?</p>
                            <div className="flex flex-wrap gap-6">
                                {destinationPages
                                    .filter((item) => item.slug !== destination.slug)
                                    .map((item) => (
                                        <Link
                                            key={item.slug}
                                            href={destinationPageHref(item)}
                                            className="inline-flex min-h-11 items-center gap-3 text-sm underline underline-offset-4"
                                        >
                                            {item.name} <ArrowUpRight size={15} />
                                        </Link>
                                    ))}
                            </div>
                        </div>
                        <div className="border-line text-muted-foreground mt-4 border-t pt-4 text-[11px] leading-6">
                            <p className="text-foreground font-medium">About this guide & photography</p>
                            <p className="mt-3 max-w-2xl">
                                Editorial sample guide. Places are real; this collection is not a live destination
                                service. Seasons are general guidance. Check visitor information for current access and
                                conditions.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-x-6">
                                {destination.sources.map((source) => (
                                    <a
                                        key={source.url}
                                        href={source.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="py-2 underline underline-offset-4"
                                    >
                                        {source.title}
                                    </a>
                                ))}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-6">
                                {[
                                    destination.hero,
                                    destination.closingImage,
                                    ...destination.places.map((place) => place.image)
                                ]
                                    .filter(
                                        (photo, index, photos) =>
                                            photos.findIndex((other) => other.src === photo.src) === index
                                    )
                                    .map((photo) => (
                                        <a
                                            key={photo.src}
                                            href={photo.sourceUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="py-2 underline underline-offset-4"
                                        >
                                            {photo.credit}
                                        </a>
                                    ))}
                            </div>
                        </div>
                    </>
                }
            >
                <header
                    id="guide"
                    tabIndex={-1}
                    aria-label={`${destination.name} introduction`}
                    className="relative flex h-full w-max shrink-0 outline-none"
                >
                    <div className="md:border-line relative isolate h-full w-[var(--destination-width)] shrink-0 overflow-hidden md:w-[clamp(420px,39vw,680px)] md:border-r">
                        <motion.div
                            initial={{ opacity: 0.35, rotate: -35 }}
                            animate={{ opacity: 1, rotate: 0 }}
                            transition={{ duration: reduced ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] }}
                            className="absolute top-1/2 right-0 aspect-square w-[200%] -translate-y-1/2 overflow-hidden rounded-full"
                        >
                            <AtlasPhoto image={destination.hero} eager sizes="(max-width: 767px) 680px, 1100px" />
                            <span aria-hidden="true" className="bg-background absolute inset-[19%] rounded-full" />
                        </motion.div>
                        <div className="absolute top-[42%] right-5 left-5 md:right-0 md:left-8">
                            <p className="mb-2 text-xs tracking-widest uppercase sm:text-sm">
                                {destination.country}{" "}
                                <span className="text-muted-foreground ml-3">{destination.nativeName}</span>
                            </p>
                            <h1
                                aria-label={destination.name}
                                className={`font-display w-fit leading-[0.82] font-bold tracking-[-0.065em] uppercase ${graphic ? "text-[clamp(4rem,min(7vw,13dvh),7.5rem)]" : "text-[clamp(4rem,min(8vw,13dvh),7rem)]"}`}
                            >
                                {destination.nameLines ? (
                                    <>
                                        {destination.nameLines?.map((line) => (
                                            <span key={line} className="block">
                                                {line}
                                            </span>
                                        ))}
                                    </>
                                ) : (
                                    destination.name
                                )}
                            </h1>
                        </div>
                        <span
                            aria-hidden="true"
                            className="text-muted-foreground absolute bottom-7 left-5 text-[10px] tracking-widest md:left-8"
                        >
                            {Math.abs(destination.coordinates.latitude).toFixed(2)}°{" "}
                            {destination.coordinates.latitude < 0 ? "S" : "N"} &nbsp;{" "}
                            {Math.abs(destination.coordinates.longitude).toFixed(2)}°{" "}
                            {destination.coordinates.longitude < 0 ? "W" : "E"}
                        </span>
                    </div>

                    <div
                        id="destination-information"
                        tabIndex={-1}
                        className="grid h-full w-[var(--destination-width)] shrink-0 grid-rows-[auto_minmax(min-content,1fr)_auto] overflow-y-auto border-l outline-none md:w-[clamp(1040px,84vw,1380px)]"
                    >
                        <section
                            aria-labelledby="destination-about-heading"
                            className="border-line border-b px-6 py-5 md:px-12 md:py-5 md:[@media(max-height:800px)]:py-3"
                        >
                            <h2 id="destination-about-heading" className="text-lg leading-tight font-bold md:text-xl">
                                about
                            </h2>
                            <p className="text-muted-foreground mt-3 max-w-[90ch] text-[13px] leading-[1.5]">
                                {destination.introduction}
                            </p>
                        </section>
                        <div className="grid md:grid-cols-[0.39fr_0.61fr]">
                            <section
                                aria-label={`${destination.name} Board starting points`}
                                className="border-line flex flex-col border-b px-6 md:border-r md:border-b-0 md:px-10"
                            >
                                <Link
                                    href="/boards/new"
                                    className="border-line flex min-h-16 shrink-0 items-center justify-end gap-3 border-b py-4 text-lg font-medium md:[@media(max-height:800px)]:min-h-12"
                                >
                                    <span className="min-w-0 text-right">start a {destination.name} board</span>
                                    <Image
                                        src="/images/destinations/opening/plus.svg"
                                        alt=""
                                        width={17.5}
                                        height={17.5}
                                        className="shrink-0 dark:invert"
                                    />
                                </Link>
                                <div className="flex flex-1 flex-col py-4 md:[@media(max-height:800px)]:py-3">
                                    <button
                                        type="button"
                                        disabled
                                        aria-describedby="destination-fork-note"
                                        className="flex min-h-11 w-full shrink-0 items-center justify-end gap-3 text-lg font-medium"
                                    >
                                        <span className="min-w-0 text-right">
                                            fork {destination.name} pins to board
                                        </span>
                                        <Image
                                            src="/images/destinations/opening/fork.svg"
                                            alt=""
                                            width={18}
                                            height={16}
                                            className="shrink-0 dark:invert"
                                        />
                                    </button>
                                    <p id="destination-fork-note" className="sr-only">
                                        Pin copying is not connected yet.
                                    </p>
                                    <ul className="text-muted-foreground mt-4 flex flex-1 flex-col justify-between gap-3 text-right text-xs leading-[1.02] md:[@media(max-height:800px)]:gap-1.5">
                                        {pins.map((pin, index) => (
                                            <li
                                                key={pin}
                                                className="ml-auto grid w-full max-w-[250px] grid-cols-[20px_1fr] items-center gap-3"
                                            >
                                                <span className="grid h-5 place-items-center" aria-hidden="true">
                                                    {destination.slug === "kyoto" && index === 2 ? (
                                                        <Image
                                                            src="/images/destinations/opening/pin-current.svg"
                                                            alt=""
                                                            width={8}
                                                            height={17}
                                                        />
                                                    ) : (
                                                        <Image
                                                            src="/images/destinations/opening/pin.svg"
                                                            alt=""
                                                            width={15.5}
                                                            height={9.50054}
                                                            className="rotate-90"
                                                        />
                                                    )}
                                                </span>
                                                <span>{pin}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </section>
                            <section
                                aria-label={`${destination.name} introduction and culture`}
                                className="text-foreground/75 flex flex-col justify-center gap-6 px-6 py-6 text-[13px] leading-[1.5] md:px-12 md:py-7 md:[@media(max-height:800px)]:gap-4 md:[@media(max-height:800px)]:py-4"
                            >
                                {paragraphs.map((paragraph) => (
                                    <p key={paragraph}>{paragraph}</p>
                                ))}
                            </section>
                        </div>
                        <section
                            aria-labelledby="destination-tags-heading"
                            className="border-line border-t px-6 py-5 md:px-12 md:[@media(max-height:800px)]:py-3"
                        >
                            <h2 id="destination-tags-heading" className="text-lg leading-tight font-bold md:text-xl">
                                tags
                            </h2>
                            <ul className="text-muted-foreground mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs md:text-[13px]">
                                {tags.map((tag) => (
                                    <li key={tag} className="underline underline-offset-4">
                                        {tag}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </div>
                </header>
                <DestinationStories destination={destination} />
                <DestinationSeasons destination={destination} />
                <DestinationAtlas destination={destination} />
                <section
                    id="destination-create"
                    tabIndex={-1}
                    aria-labelledby="destination-create-heading"
                    className="bg-background border-line relative isolate h-full w-[var(--destination-width)] shrink-0 overflow-x-hidden overflow-y-auto border-l outline-none lg:w-[max(1250px,var(--destination-width))] lg:overflow-y-hidden"
                >
                    <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 left-0 hidden w-12 bg-[var(--atlas-background)] [clip-path:ellipse(100%_60%_at_0%_50%)] lg:block"
                    />
                    <div className="relative z-10 flex flex-col px-6 pt-10 pb-8 lg:min-h-full lg:w-[56%] lg:pt-[6dvh] lg:pr-0 lg:pb-7 lg:pl-16">
                        <h2
                            id="destination-create-heading"
                            className="font-display text-[clamp(4rem,min(8vw,13dvh),8rem)] leading-[1.02] font-bold tracking-[-0.055em]"
                        >
                            CREATE
                            <br />
                            YOUR
                            <br />
                            OWN
                        </h2>
                        <Link
                            href="/boards/new"
                            className="group bg-foreground text-background hover:bg-foreground/85 mt-9 flex min-h-16 shrink-0 items-center gap-5 px-5 py-5 text-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 motion-reduce:transition-none lg:mt-10 lg:min-h-24 lg:w-[calc(100%+12rem)] lg:px-9 lg:text-[clamp(1.5rem,2.5vw,2.75rem)] md:[@media(max-height:800px)]:min-h-12"
                        >
                            <span>ENTER BOARD CREATOR</span>
                            <ArrowUpRight
                                size={28}
                                strokeWidth={1}
                                className="shrink-0 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none"
                            />
                        </Link>
                        <div className="pt-9 lg:mt-auto lg:pt-7">
                            <p className="text-xl">{destination.name} - your way</p>
                            <p className="text-muted-foreground mt-2 max-w-[30ch] text-sm leading-[1.3]">
                                Start your own {destination.name} board from scratch and shape the trip your way.
                            </p>
                        </div>
                    </div>
                    <div
                        aria-hidden="true"
                        className="pointer-events-none relative -mt-3 ml-[18%] aspect-[1077/1254] w-[125%] overflow-hidden rounded-[50%] lg:absolute lg:top-1/2 lg:left-[48%] lg:z-20 lg:mt-0 lg:ml-0 lg:w-[max(780px,60vw)] lg:-translate-y-1/2"
                    >
                        <motion.div
                            className="absolute inset-[-8%]"
                            style={{ rotate: destination.closingImageRotation ?? 0 }}
                        >
                            <AtlasPhoto image={destination.closingImage} sizes="(max-width: 1023px) 125vw, 100vw" />
                        </motion.div>
                    </div>
                </section>
            </DestinationRail>
        </MotionConfig>
    );
}
