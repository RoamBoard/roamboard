import { createTodoController } from "./todo.controller.js";
import { createTodoRepository } from "./todo.repository.js";
import { createTodoRouter } from "./todo.routes.js";
import { createTodoService } from "./todo.service.js";

export function createTodoModule({ repository = createTodoRepository() } = {}) {
  const service = createTodoService(repository);
  const controller = createTodoController(service);
  const router = createTodoRouter(controller);

  return {
    router,
    service,
    repository,
  };
}

