import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import HandleProfileContent from "@/components/features/profile/HandleProfileContent";
import BackLink from "@/components/ui/BackLink";

export const metadata: Metadata = { title: "Profile | Roamboard" };

export default async function HandleProfilePage({
    params,
    searchParams
}: {
    params: Promise<{ handle: string }>;
    searchParams: Promise<{ updated?: string | string[] }>;
}) {
    const [{ handle }, query] = await Promise.all([params, searchParams]);
    return (
        <AppShell activeHref="/profile" profile={{ profileHref: "/profile", settingsHref: "/settings" }}>
            <div className="relative h-full w-full overflow-hidden">
                <div className="h-full w-full overflow-y-auto">
                    <BackLink fallbackHref="/social" className="mt-6 ml-4 sm:ml-8" />
                    <div className="px-4 pt-6 pb-20 sm:px-8 md:px-12 lg:px-16">
                        <HandleProfileContent key={handle} handle={handle} profileSaved={query.updated === "1"} />
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
