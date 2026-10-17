import { destinationPageHref, findDestinationPage } from "@/data/destination-atlas";
import type { Destination } from "./destinations";

export function destinationSearchHref(destination: Destination) {
    const guide = findDestinationPage(destination);
    if (guide) return destinationPageHref(guide);
    const slug = destination.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "");
    return `/discover/destinations/${encodeURIComponent(slug)}`;
}
