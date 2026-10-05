import type { Metadata } from "next";
import BoardsLanding from "@/components/features/boards/BoardsLanding";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Create a Board | Roamboard",
  description: "Start a new Roamboard travel Board.",
};

export default function BoardsPage() {
  return (
    <AppShell activeHref="/boards" profile={{ href: "/profile" }}>
      <BoardsLanding />
    </AppShell>
  );
}
