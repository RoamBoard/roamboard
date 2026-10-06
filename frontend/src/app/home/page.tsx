import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import CenteredPrompt from "@/components/ui/CenteredPrompt";

export const metadata: Metadata = {
    title: "Home | Roamboard"
};

export default function HomePage() {
    return (
        <AppShell activeHref="/home">
            <CenteredPrompt
                label="Where would you like to go?"
                placeholder="so, where is it you wish to go?"
                name="destination"
            />
        </AppShell>
    );
}
