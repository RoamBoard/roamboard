import type { RequestHandler } from "express";

import type {
  CreateTodoRequest,
  DeleteTodoRequest,
  GetTodoRequest,
  ListTodosRequest,
  UpdateTodoRequest,
} from "./todo.schemas.js";
import type { TodoService } from "./todo.types.js";

export interface TodoController {
  list: RequestHandler;
  getById: RequestHandler;
  create: RequestHandler;
  update: RequestHandler;
  remove: RequestHandler;
}

export function createTodoController(service: TodoService): TodoController {
  const list: RequestHandler = async (req, res) => {
    const { query } = req.validated as ListTodosRequest;
    const todos = await service.listTodos(query);
    res.json({ data: todos });
  };

  const getById: RequestHandler = async (req, res) => {
    const { params } = req.validated as GetTodoRequest;
    const todo = await service.getTodo(params.todoId);
    res.json({ data: todo });
  };

  const create: RequestHandler = async (req, res) => {
    const { body } = req.validated as CreateTodoRequest;
    const todo = await service.createTodo(body);
    res.status(201).json({ data: todo });
  };

  const update: RequestHandler = async (req, res) => {
    const { params, body } = req.validated as UpdateTodoRequest;
    const todo = await service.updateTodo(params.todoId, body);
    res.json({ data: todo });
  };

  const remove: RequestHandler = async (req, res) => {
    const { params } = req.validated as DeleteTodoRequest;
    await service.deleteTodo(params.todoId);
    res.status(204).send();
  };

  return {
    list,
    getById,
    create,
    update,
    remove,
  };
}
