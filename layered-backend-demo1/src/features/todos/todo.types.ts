export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TodoFilters {
  completed?: boolean;
}

export interface CreateTodoInput {
  title: string;
}

export interface CreateTodoRecord extends CreateTodoInput {
  completed: boolean;
}

export interface UpdateTodoInput {
  title?: string;
  completed?: boolean;
}

export interface TodoRepository {
  findAll(filters?: TodoFilters): Promise<Todo[]>;
  findById(id: string): Promise<Todo | null>;
  create(input: CreateTodoRecord): Promise<Todo>;
  update(id: string, changes: UpdateTodoInput): Promise<Todo | null>;
  remove(id: string): Promise<boolean>;
}

export interface TodoService {
  listTodos(filters?: TodoFilters): Promise<Todo[]>;
  getTodo(id: string): Promise<Todo>;
  createTodo(input: CreateTodoInput): Promise<Todo>;
  updateTodo(id: string, changes: UpdateTodoInput): Promise<Todo>;
  deleteTodo(id: string): Promise<void>;
}
