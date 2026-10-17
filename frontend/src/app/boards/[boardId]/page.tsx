import type { Metadata } from "next";
import DatabasePublishedBoard from "@/components/features/boards/DatabasePublishedBoard";

type Props = {
    params: Promise<{ boardId: string }>;
};

export const metadata: Metadata = {
    title: "Board | Roamboard",
    description: "View a published Roamboard Board.",
    robots: { index: false, follow: false }
};

export default async function BoardPage({ params }: Props) {
    const { boardId } = await params;

    // One live viewer handles every saved Board; the backend decides who can read it.
    return <DatabasePublishedBoard key={boardId} boardId={boardId} />;
}
