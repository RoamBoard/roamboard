import { uploadBoardImage } from "./board-creator-api";

export async function uploadBoardImageBatch(files: File[]) {
    if (files.length > 30) throw new Error("Choose up to 30 photos per batch.");
    const results: PromiseSettledResult<Awaited<ReturnType<typeof uploadBoardImage>>>[] = new Array(files.length);
    const queue = files.map((file, index) => ({ file, index }));
    await Promise.all(
        Array.from({ length: Math.min(4, files.length) }, async () => {
            while (queue.length) {
                const next = queue.shift();
                if (!next) break;
                const { file, index } = next;
                try {
                    results[index] = { status: "fulfilled", value: await uploadBoardImage(file) };
                } catch (reason) {
                    results[index] = { status: "rejected", reason };
                }
            }
        })
    );
    return {
        assets: results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : [])),
        failures: results.flatMap((result, index) =>
            result.status === "rejected"
                ? [
                      files[index].name +
                          ": " +
                          (result.reason instanceof Error ? result.reason.message : "Upload failed.")
                  ]
                : []
        )
    };
}
