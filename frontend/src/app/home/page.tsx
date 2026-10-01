import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import DestinationExplorer from "@/components/features/destinations/DestinationExplorer";

export const metadata: Metadata = {
  title: "Home | Roamboard",
};

export default function HomePage() {
  return (
    <AppShell activeHref="/home" profile={{ href: "/profile" }}
>
      <DestinationExplorer />
    </AppShell>
  );
}
