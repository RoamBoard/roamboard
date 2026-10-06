import type { Metadata } from "next";
import WelcomeScreen from "@/components/features/welcome/WelcomeScreen";

export const metadata: Metadata = {
    title: "Welcome back | Roamboard",
    robots: { index: false, follow: false }
};

export default function WelcomePage() {
    // Frontend preview only. Replace this with the authenticated user's username
    // and check their session when the backend authentication contract exists.
    const previewUsername = "Rowan";

    return <WelcomeScreen username={previewUsername} />;
}
