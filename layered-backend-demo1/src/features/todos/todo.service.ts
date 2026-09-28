import { AppError } from "../../shared/app-error.js";
import type {
  CreateTodoInput,
  Todo,
  TodoFilters,
  TodoRepository,
  TodoService,
  UpdateTodoInput,
} from "./todo.types.js";

export function createTodoService(repository: TodoRepository): TodoService {
  async function listTodos(filters?: TodoFilters): Promise<Todo[]> {
    return repository.findAll(filters);
  }

  async function getTodo(id: string): Promise<Todo> {
    const todo = await repository.findById(id);

    if (!todo) {
      throw new AppError(404, "Todo not found");
    }

    return todo;
  }

  async function createTodo({ title }: CreateTodoInput): Promise<Todo> {
    return repository.create({
      title,
      completed: false,
    });
  }

  async function updateTodo(
    id: string,
    changes: UpdateTodoInput,
  ): Promise<Todo> {
    const todo = await repository.update(id, changes);

    if (!todo) {
      throw new AppError(404, "Todo not found");
    }

    return todo;
  }

  async function deleteTodo(id: string): Promise<void> {
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
    deleteTodo,
  };
}
