import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { DestinationReady } from "@/components/features/destinations/DestinationTransitionProvider";
import RoamTransitionLab from "./RoamTransitionLab";

export const metadata = { title: "Roam transition lab", robots: { index: false, follow: false } };

// Controlled route latency belongs only in this development test surface.
// No destination fetch or production navigation has an artificial data delay.
export default async function RoamLab({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
    if (process.env.NODE_ENV !== "development") notFound();
    const { scenario } = await searchParams;
    if (scenario === "slow") await new Promise((resolve) => setTimeout(resolve, 7000));
    if (scenario === "failed") throw new Error("Controlled destination readiness failure");
    return (
        <AppShell activeHref="/home">
            {scenario && <DestinationReady href={`/dev/roam?scenario=${encodeURIComponent(scenario)}`} />}
            <RoamTransitionLab complete={Boolean(scenario)} />
        </AppShell>
    );
}
