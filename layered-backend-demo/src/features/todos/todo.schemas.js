import { z } from "zod";

// This schemas file creates a blueprint for what each endpoint's parameters should look like.
// It is used to validate incoming query parameters at the url level, and occasionally at the body level.

const todoIdParams = z.object({
    todoId: z.string().uuid()
});

export const listTodosSchema = z.object({
    query: z.object({
        completed: z
            .enum(["true", "false"])
            .transform((value) => value === "true")
            .optional()
    })
});

export const getTodoSchema = z.object({
    params: todoIdParams
});

export const createTodoSchema = z.object({
    body: z
        .object({
            title: z.string().trim().min(1).max(200)
        })
        .strict()
});

export const updateTodoSchema = z.object({
    params: todoIdParams,
    body: z
        .object({
            title: z.string().trim().min(1).max(200).optional(),
            completed: z.boolean().optional()
        })
        .strict()
        .refine((body) => body.title !== undefined || body.completed !== undefined, {
            message: "At least one field must be provided"
        })
});

export const deleteTodoSchema = z.object({
    params: todoIdParams
});
