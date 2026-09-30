import { randomUUID } from "node:crypto";

import type {
  CreateTodoRecord,
  Todo,
  TodoFilters,
  TodoRepository,
  UpdateTodoInput,
} from "./todo.types.js";

function copyTodo(todo: Todo | null | undefined): Todo | null {
  return todo ? { ...todo } : null;
}

export function createTodoRepository(): TodoRepository {
  const todos = new Map<string, Todo>();

  async function findAll({ completed }: TodoFilters = {}): Promise<Todo[]> {
    const results = Array.from(todos.values());
    const filtered =
      completed === undefined
        ? results
        : results.filter((todo) => todo.completed === completed);

    return filtered.map((todo) => ({ ...todo }));
  }

  async function findById(id: string): Promise<Todo | null> {
    return copyTodo(todos.get(id));
  }

  async function create({
    title,
    completed,
  }: CreateTodoRecord): Promise<Todo> {
    const now = new Date().toISOString();
    const todo: Todo = {
      id: randomUUID(),
      title,
      completed,
      createdAt: now,
      updatedAt: now,
    };

    todos.set(todo.id, todo);
    return { ...todo };
  }

  async function update(
    id: string,
    changes: UpdateTodoInput,
  ): Promise<Todo | null> {
    const current = todos.get(id);

    if (!current) {
      return null;
    }

    const updated: Todo = {
      ...current,
      ...changes,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    };

    todos.set(id, updated);
    return { ...updated };
  }

  async function remove(id: string): Promise<boolean> {
    return todos.delete(id);
  }

  return {
    findAll,
    findById,
    create,
    update,
    remove,
  };
}
