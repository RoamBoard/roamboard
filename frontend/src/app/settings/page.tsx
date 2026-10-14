import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import SettingsContent from "@/components/features/settings/SettingsContent";

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
            <div className="relative h-full w-full overflow-hidden">
                <div className="h-full w-full overflow-y-auto px-4 pt-6 pb-20 sm:px-8 sm:pt-8 md:px-12 md:pt-10 lg:px-16">
                    <SettingsContent />
                </div>
            </div>
        </AppShell>
    );
}
