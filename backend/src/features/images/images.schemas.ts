import { z } from "zod";
export const imageEditSchema = z
    .object({
        x: z.number().finite().min(0).max(1),
        y: z.number().finite().min(0).max(1),
        width: z.number().finite().min(0.01).max(1),
        height: z.number().finite().min(0.01).max(1),
        outputWidth: z.number().int().min(32).max(4096),
        outputHeight: z.number().int().min(32).max(4096)
    })
    .strict()
    .refine(
        (edit) => edit.x + edit.width <= 1.000001 && edit.y + edit.height <= 1.000001,
        "Crop must stay inside the image"
    );
export const saveImageEditSchema = z
    .object({ revision: z.number().int().nonnegative(), edit: imageEditSchema.nullable() })
    .strict();
export type ImagePresentationEdit = z.infer<typeof imageEditSchema>;
