import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import HandleProfileContent from "@/components/features/profile/HandleProfileContent";

export const metadata: Metadata = { title: "Profile | Roamboard" };

export default async function HandleProfilePage({ params }: { params: Promise<{ handle: string }> }) {
    const { handle } = await params;
    return (
        <AppShell activeHref="/profile" profile={{ profileHref: "/profile", settingsHref: "/settings" }}>
            <div className="relative h-full w-full overflow-hidden">
                <div className="h-full w-full overflow-y-auto px-4 pt-6 pb-20 sm:px-8 sm:pt-8 md:px-12 md:pt-10 lg:px-16">
                    <HandleProfileContent key={handle} handle={handle} />
                </div>
            </div>
        </AppShell>
    );
}
