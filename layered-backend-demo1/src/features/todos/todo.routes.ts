import { Router } from "express";

import { validate } from "../../middleware/validate.js";
import type { TodoController } from "./todo.controller.js";
import {
  createTodoSchema,
  deleteTodoSchema,
  getTodoSchema,
  listTodosSchema,
  updateTodoSchema,
} from "./todo.schemas.js";

export function createTodoRouter(controller: TodoController): Router {
  const router = Router();

  router.get("/", validate(listTodosSchema), controller.list);
  router.get("/:todoId", validate(getTodoSchema), controller.getById);
  router.post("/", validate(createTodoSchema), controller.create);
  router.patch("/:todoId", validate(updateTodoSchema), controller.update);
  router.delete("/:todoId", validate(deleteTodoSchema), controller.remove);

  return router;
}
