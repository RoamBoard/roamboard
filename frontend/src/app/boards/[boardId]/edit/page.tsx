import BoardCreator from "@/components/features/boards/BoardCreator";
import AppShell from "@/components/layout/AppShell";

export default async function EditPublishedBoardPage({ params }: { params: Promise<{ boardId: string }> }) {
    const { boardId } = await params;
    return (
        <AppShell activeHref="/create">
            <BoardCreator initialBoardId={Number(boardId)} expectedStatus="published" backHref={`/boards/${boardId}`} />
        </AppShell>
    );
}
