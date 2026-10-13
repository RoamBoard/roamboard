import { AppError } from "../../shared/app-error.js";

// Returns an object with references to the functions defined in here
export function createTodoService(repository) {
    async function listTodos(filters) {
        // filters == req.validated.query
        return repository.findAll(filters);
    }

    async function getTodo(id) {
        const todo = await repository.findById(id);

        if (!todo) {
            throw new AppError(404, "Todo not found");
        }

        return todo;
    }

    async function createTodo({ title }) {
        return repository.create({
            title,
            completed: false
        });
    }

    async function updateTodo(id, changes) {
        const todo = await repository.update(id, changes);

        if (!todo) {
            throw new AppError(404, "Todo not found");
        }

        return todo;
    }

    async function deleteTodo(id) {
        const removed = await repository.remove(id);

        if (!removed) {
            throw new AppError(404, "Todo not found");
        }
    }

    return {
        listTodos,
        getTodo,
        createTodo,
        updateTodo,
        deleteTodo
    };
}
