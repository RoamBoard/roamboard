import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import ProviderLab from "@/components/features/providers/ProviderLab";

export const metadata: Metadata = { title: "Provider lab | Roamboard" };

export default function ProvidersPage() {
  return <AppShell activeHref="/dev/providers" profile={{ href: "/profile" }}><ProviderLab /></AppShell>;
}