import type { Metadata } from "next";
import BoardDatabaseBrowser from "@/components/features/boards/BoardDatabaseBrowser";

export const metadata: Metadata = {
  title: "Saved boards | Roamboard",
  robots: { index: false, follow: false },
};

export default function BoardInputTestPage() {
  return (
    <main>
      <BoardDatabaseBrowser />
    </main>
  );
}
