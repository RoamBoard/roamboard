import { randomUUID } from "node:crypto";

function copyTodo(todo) {
    return todo ? { ...todo } : null;
}

export function createTodoRepository() {
    const todos = new Map(); // A mock for a database, will be replaced by postgres

    async function findAll({ completed } = {}) {
        const results = Array.from(todos.values());
        const filtered =
            completed === undefined
                ? results
                : results.filter((todo) => todo.completed === completed);

        return filtered.map(copyTodo);
    }

    async function findById(id) {
        return copyTodo(todos.get(id));
    }

    async function create({ title, completed }) {
        const now = new Date().toISOString();
        const todo = {
            id: randomUUID(),
            title,
            completed,
            createdAt: now,
            updatedAt: now
        };

        todos.set(todo.id, todo);
        return copyTodo(todo);
    }

    async function update(id, changes) {
        const current = todos.get(id);

        if (!current) {
            return null;
        }

        const updated = {
            ...current,
            ...changes,
            id: current.id,
            createdAt: current.createdAt,
            updatedAt: new Date().toISOString()
        };

        todos.set(id, updated);
        return copyTodo(updated);
    }

    async function remove(id) {
        return todos.delete(id);
    }

    return {
        findAll,
        findById,
        create,
        update,
        remove
    };
}
