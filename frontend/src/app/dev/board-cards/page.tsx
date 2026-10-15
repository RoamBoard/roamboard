import type { Metadata } from "next";
import BoardCardGallery from "@/components/features/boards/cards/BoardCardGallery";

export const metadata: Metadata = {
    title: "Board card gallery | Roamboard",
    robots: { index: false, follow: false }
};

export default function BoardCardsPage() {
    return <BoardCardGallery />;
}
