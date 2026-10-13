import { z } from "zod";

export const googleSignInSchema = z
    .object({
        credential: z.string().min(1).max(10000)
    })
    .strict();
