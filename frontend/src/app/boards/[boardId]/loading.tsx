import BoardPageMessage from "@/components/features/boards/BoardPageMessage";

export default function LoadingBoard() {
    return (
        <BoardPageMessage title="Loading board">
            <p role="status">Getting the journey ready…</p>
        </BoardPageMessage>
    );
}
