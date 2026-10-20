import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import DestinationTypographyLab from "@/components/features/destinations/DestinationTypographyLab";

export const metadata = { title: "Destination typography review | Roamboard", robots: { index: false, follow: false } };

export default function DestinationTypographyReview() {
    if (process.env.NODE_ENV !== "development") notFound();
    return (
        <AppShell activeHref="/discover">
            <DestinationTypographyLab />
        </AppShell>
    );
}
