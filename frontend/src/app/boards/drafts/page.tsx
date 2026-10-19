import DraftBoardList from "@/components/features/boards/DraftBoardList";
import AppShell from "@/components/layout/AppShell";

export default function DraftsPage() {
    return (
        <AppShell activeHref="/create" backHref="/create">
            <DraftBoardList />
        </AppShell>
    );
}
