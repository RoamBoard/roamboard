import { z } from "zod";

const todoIdParams = z.object({
  todoId: z.string().uuid(),
});

export const listTodosSchema = z.object({
  query: z.object({
    completed: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  }),
});

export const getTodoSchema = z.object({
  params: todoIdParams,
});

export const createTodoSchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(1).max(200),
    })
    .strict(),
});

export const updateTodoSchema = z.object({
  params: todoIdParams,
  body: z
    .object({
      title: z.string().trim().min(1).max(200).optional(),
      completed: z.boolean().optional(),
    })
    .strict()
    .refine(
      (body) =>
        body.title !== undefined || body.completed !== undefined,
      { message: "At least one field must be provided" },
    ),
});

export const deleteTodoSchema = z.object({
  params: todoIdParams,
});

export type ListTodosRequest = z.infer<typeof listTodosSchema>;
export type GetTodoRequest = z.infer<typeof getTodoSchema>;
export type CreateTodoRequest = z.infer<typeof createTodoSchema>;
export type UpdateTodoRequest = z.infer<typeof updateTodoSchema>;
export type DeleteTodoRequest = z.infer<typeof deleteTodoSchema>;
