import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import DestinationExplorer from "@/components/features/destinations/DestinationExplorer";

export const metadata: Metadata = {
    title: "Roam | Roamboard"
};

export default function RoamPage() {
    return (
        <AppShell activeHref="/home">
            <DestinationExplorer />
        </AppShell>
    );
}
