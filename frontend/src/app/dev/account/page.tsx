import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
    title: "Account control preview | Roamboard",
    robots: { index: false, follow: false }
};

export default function AccountPreviewPage() {
    return (
        <AppShell
            activeHref="/dev/account"
            profile={{ user: { name: "Preview user" } }}
        >
            <div className="grid place-items-center px-16 text-center">
                <p>
                    Account Page
                </p>
            </div>
        </AppShell>
    );
}
