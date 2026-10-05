import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import SettingsContent from "@/components/features/settings/SettingsContent";
import { mockRowanProfile } from "@/data/mock-social";

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
                settingsHref: "/settings",
                userName: mockRowanProfile.name,
                avatarUrl: mockRowanProfile.avatarUrl
            }}
        >
            <div className="relative h-full w-full overflow-hidden">
                <div
                    aria-hidden="true"
                    className="bg-line pointer-events-none absolute inset-y-0 left-[9rem] w-px sm:left-[10rem] lg:left-[11rem]"
                />

                <div className="h-full w-full overflow-y-auto pt-10 pr-8 pl-[11.5rem] sm:pr-16 sm:pl-[12.5rem] lg:pr-24 lg:pl-[14rem]">
                    <SettingsContent />
                </div>
            </div>
        </AppShell>
    );
}
