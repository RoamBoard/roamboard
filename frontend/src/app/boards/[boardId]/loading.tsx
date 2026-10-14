import BoardPageMessage from "@/components/features/boards/BoardPageMessage";

// Next.js can show this while the board page is loading.
export default function LoadingBoard() {
    return (
        <BoardPageMessage title="Loading board">
            <p role="status">Getting the journey ready…</p>
        </BoardPageMessage>
    );
}
