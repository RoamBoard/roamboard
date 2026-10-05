import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import GoogleAuthPanel from "@/components/features/auth/GoogleAuthPanel";

export const metadata: Metadata = {
    title: "Log in | Roamboard"
};

export default function LoginPage() {
    return (
        <AppShell activeHref="/login">
            <div className="min-h-0 overflow-y-auto pr-6 pl-20 sm:px-24">
                <div className="grid min-h-full place-items-center pt-40 pb-12 sm:py-12">
                    <GoogleAuthPanel mode="login" />
                </div>
            </div>
        </AppShell>
    );
}
