import type { Router } from "express"; // ts

// ts
import {
  createTodoController,
  type TodoController,
} from "./todo.controller.js";

import { createTodoRepository } from "./todo.repository.js";
import { createTodoRouter } from "./todo.routes.js";
import { createTodoService } from "./todo.service.js";
// ts
import type { TodoRepository, TodoService } from "./todo.types.js";

// ts
export interface TodoModule {
  router: Router;
  controller: TodoController;
  service: TodoService;
  repository: TodoRepository;
}
// ts
interface CreateTodoModuleOptions {
  repository?: TodoRepository;
}

export function createTodoModule(
  { repository = createTodoRepository() }: CreateTodoModuleOptions = {},
): TodoModule {
  const service = createTodoService(repository);
  const controller = createTodoController(service);
  const router = createTodoRouter(controller);

  return {
    router,
    controller,
    service,
    repository,
  };
}
