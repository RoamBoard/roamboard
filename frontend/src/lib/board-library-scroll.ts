import type { CarouselApi } from "@/components/ui/carousel";

// Embla 8.6 exposes distance scrolling through its engine; keep this version-specific bridge in one place.
export function scrollBoardLibrary(api: CarouselApi, progress: number) {
    const engine = api.internalEngine();
    const fraction = Math.max(0, Math.min(1, progress));
    const target = engine.limit.max - engine.limit.length * fraction;
    engine.scrollBody.useBaseFriction().useDuration(0);
    engine.scrollTo.distance(target - engine.target.get(), false);
}
