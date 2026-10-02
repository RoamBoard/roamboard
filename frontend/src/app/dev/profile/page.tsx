import type { Metadata } from "next";

import ProfilePrototype from "@/components/features/profile/ProfilePrototype";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = { title: "Profile API prototype | Roamboard", robots: { index: false, follow: false } };

export default function ProfilePrototypePage() {
  return <AppShell activeHref="/dev/profile" profile={{ href: "/dev/profile" }}><ProfilePrototype /></AppShell>;
}
