import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import NotificationsContent from "@/components/features/notifications/NotificationsContent";

export const metadata: Metadata = {
    title: "Notifications | Roamboard",
    description: "Manage your friend requests and notifications on Roamboard."
};

export default function NotificationsPage() {
    return (
        <AppShell
            activeHref="/social"
            profile={{
                profileHref: "/profile",
                settingsHref: "/settings"
            }}
        >
            <NotificationsContent />
        </AppShell>
    );
}

