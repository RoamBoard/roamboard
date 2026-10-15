import type { RequestHandler } from "express";
import { AppError } from "../../shared/app-error.js";

export const parseUpload: RequestHandler = async (request, response, next) => {
    let form: FormData;
    try {
        form = await new Request("http://localhost/upload", {
            method: "POST",
            headers: { "Content-Type": request.get("content-type") ?? "" },
            body: new Uint8Array(request.body as Buffer).buffer
        }).formData();
    } catch {
        throw new AppError(400, "Choose an image in the file field", "INVALID_REQUEST");
    }
    const file = form.get("file");
    if ([...form.keys()].some((name) => name !== "file"))
        throw new AppError(400, "Unknown upload field", "INVALID_REQUEST");
    if (!(file instanceof File) || form.getAll("file").length !== 1)
        throw new AppError(400, "Choose one image", "INVALID_REQUEST");
    if (file.size === 0) throw new AppError(400, "Choose a nonempty image", "INVALID_REQUEST");
    if (file.size > 10000000) throw new AppError(413, "Image exceeds 10 MB", "IMAGE_TOO_LARGE");
    if (!/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name))
        throw new AppError(400, "Unsupported image type", "INVALID_REQUEST");
    response.locals.file = {
        buffer: Buffer.from(await file.arrayBuffer()),
        mimetype: file.type,
        originalname: file.name
    };
    next();
};
