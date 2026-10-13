import BoardPageMessage from "@/components/features/boards/BoardPageMessage";

export default function BoardNotFound() {
    return (
        <BoardPageMessage title="Board not found">
            This board could not be found or is not publicly available.
        </BoardPageMessage>
    );
}
