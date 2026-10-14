import BoardPageMessage from "@/components/features/boards/BoardPageMessage";

// This appears when the page calls notFound for a missing or non-public board.
export default function BoardNotFound() {
    return (
        <BoardPageMessage title="Board not found">
            This board could not be found or is not publicly available.
        </BoardPageMessage>
    );
}
