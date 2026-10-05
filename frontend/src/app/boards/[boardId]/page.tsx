import type { Metadata } from "next";

import PublishedBoardView from "@/components/features/boards/PublishedBoardView";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Board inspector | Roamboard",
  description: "Inspect a saved Roamboard Board.",
};

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  return <AppShell activeHref="/boards" profile={{ href: "/profile" }}><PublishedBoardView boardId={boardId} /></AppShell>;
}
