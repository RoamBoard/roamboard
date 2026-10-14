import { randomUUID } from "node:crypto";

import type { Pool } from "pg";

import type { CreateTodoRecord, Todo, TodoFilters, TodoRepository, UpdateTodoInput } from "./todo.types.js";

interface TodoRow {
    id: string;
    title: string;
    completed: boolean;
    created_at: Date;
    updated_at: Date;
}

const columns = "id, title, completed, created_at, updated_at";

function toTodo(row: TodoRow): Todo {
    return {
        id: row.id,
        title: row.title,
        completed: row.completed,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString()
    };
}

export function createPostgresTodoRepository(pool: Pool): TodoRepository {
    async function findAll({ completed }: TodoFilters = {}): Promise<Todo[]> {
        const result =
            completed === undefined
                ? await pool.query<TodoRow>(`SELECT ${columns} FROM todos ORDER BY created_at, id`)
                : await pool.query<TodoRow>(
                      `SELECT ${columns} FROM todos WHERE completed = $1 ORDER BY created_at, id`,
                      [completed]
                  );
        return result.rows.map(toTodo);
    }

    async function findById(id: string): Promise<Todo | null> {
        const result = await pool.query<TodoRow>(`SELECT ${columns} FROM todos WHERE id = $1`, [id]);
        return result.rows[0] ? toTodo(result.rows[0]) : null;
    }

    async function create({ title, completed }: CreateTodoRecord): Promise<Todo> {
        const result = await pool.query<TodoRow>(
            `INSERT INTO todos (id, title, completed) VALUES ($1, $2, $3) RETURNING ${columns}`,
            [randomUUID(), title, completed]
        );
        const row = result.rows[0];
        if (!row) throw new Error("PostgreSQL did not return the created todo");
        return toTodo(row);
    }

    async function update(id: string, changes: UpdateTodoInput): Promise<Todo | null> {
        const result = await pool.query<TodoRow>(
            `UPDATE todos
       SET title = COALESCE($2, title), completed = COALESCE($3, completed), updated_at = now()
       WHERE id = $1 RETURNING ${columns}`,
            [id, changes.title ?? null, changes.completed ?? null]
        );
        return result.rows[0] ? toTodo(result.rows[0]) : null;
    }

    async function remove(id: string): Promise<boolean> {
        const result = await pool.query("DELETE FROM todos WHERE id = $1", [id]);
        return result.rowCount === 1;
    }

    return { findAll, findById, create, update, remove };
}
