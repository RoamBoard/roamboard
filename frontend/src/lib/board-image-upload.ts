import { uploadBoardImage } from "./board-creator-api";

export async function uploadBoardImageBatch(files: File[]) {
    const results = await Promise.allSettled(files.map((file) => uploadBoardImage(file)));
    return {
        assets: results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : [])),
        failures: results.flatMap((result, index) =>
            result.status === "rejected"
                ? [`${files[index].name}: ${result.reason instanceof Error ? result.reason.message : "Upload failed."}`]
                : []
        )
    };
}
