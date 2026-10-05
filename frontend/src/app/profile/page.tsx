import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
    title: "Profile | Roamboard"
};

export default function ProfilePage() {
    return (
        <AppShell activeHref="/profile">
            <div className="grid place-items-center text-center">
                <div>
                    <h1 className="font-display text-24">Profile</h1>
                    <p className="font-body text-14 text-graphite mt-2">
                        This page is a placeholder.
                    </p>
                </div>
            </div>
        </AppShell>
    );
}
