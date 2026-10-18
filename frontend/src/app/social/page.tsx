import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import SocialFriendsContent from "@/components/features/social/SocialFriendsContent";

export const metadata: Metadata = {
    title: "Friends | Roamboard",
    description: "Connect with travel pals, explore friends' boards, and stay inspired on Roamboard."
};

export default function SocialPage() {
    return (
        <AppShell
            activeHref="/social"
            profile={{
                profileHref: "/profile",
                settingsHref: "/settings"
            }}
        >
            <SocialFriendsContent />
        </AppShell>
    );
}
