import { z } from "zod";

export const googleSignInSchema = z
    .object({
        credential: z.string().min(1).max(10000)
    })
    .strict();

export const createGuestSchema = z.object({ username: z.string().regex(/^[a-z][a-z0-9_]{2,29}$/) }).strict();

export const guestSignInSchema = z.object({ userId: z.string().regex(/^guest:[0-9a-f-]{36}$/) }).strict();
