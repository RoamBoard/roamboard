import type { Metadata } from "next";
import AuthenticatedWelcome from "@/components/features/welcome/AuthenticatedWelcome";

export const metadata: Metadata = {
    title: "Welcome back | Roamboard",
    robots: { index: false, follow: false }
};

export default function WelcomePage() {
    return <AuthenticatedWelcome />;
}
