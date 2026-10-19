import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import SettingsContent from "@/components/features/settings/SettingsContent";
import BackLink from "@/components/ui/BackLink";

export const metadata: Metadata = {
    title: "Settings | Roamboard",
    description: "Account and profile preferences on Roamboard."
};

export default function SettingsPage() {
    return (
        <AppShell
            activeHref="/settings"
            profile={{
                profileHref: "/profile",
                settingsHref: "/settings"
            }}
        >
            <div className="relative h-full w-full overflow-hidden [contain:layout]">
                <div className="h-full w-full [scrollbar-gutter:stable_both-edges] overflow-y-auto">
                    <BackLink fallbackHref="/profile" className="mt-6 ml-4 sm:ml-8" />
                    <div className="px-4 pt-6 pb-20 sm:px-8 md:px-12 lg:px-16">
                        <SettingsContent />
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
