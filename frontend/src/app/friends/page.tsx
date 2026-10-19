import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import FriendsPageContent from "@/components/features/friends/FriendsPageContent";

export const metadata: Metadata = {
    title: "Friends | Roamboard",
    description: "View and manage all your travel pals on Roamboard."
};

export default function FriendsPage() {
    return (
        <AppShell
            activeHref="/social"
            profile={{
                profileHref: "/profile",
                settingsHref: "/settings"
            }}
        >
            <FriendsPageContent />
        </AppShell>
    );
}
