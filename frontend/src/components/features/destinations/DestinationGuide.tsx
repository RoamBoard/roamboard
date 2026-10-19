"use client";

import BackLink from "@/components/ui/BackLink";
import type { DestinationGuideInput } from "@/lib/destination-guides";
import { DestinationPage } from "./DestinationPage";
import useDestinationGuide from "./useDestinationGuide";

// Load real content separately from the guide's presentation components.
export default function DestinationGuide({ input }: { input: DestinationGuideInput }) {
    const { data, error, loading, retry, loadMore } = useDestinationGuide(input);
    if (!data)
        return (
            <section className="min-h-[70dvh] px-6 py-20 md:px-12">
                <BackLink fallbackHref="/discover" />
                <h1 className="font-display text-48 mt-8">{input.name}</h1>
                {error ? (
                    <p role="alert" className="mt-5">
                        {error}
                    </p>
                ) : (
                    <p role="status" className="mt-5">
                        Loading destination guide...
                    </p>
                )}
                {error ? (
                    <button type="button" onClick={retry} className="border-line mt-6 min-h-11 border px-5">
                        Try again
                    </button>
                ) : null}
            </section>
        );
    return (
        <DestinationPage destination={data} loadingMore={loading} error={error} onRetry={retry} onLoadMore={loadMore} />
    );
}
