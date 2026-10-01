export function createTodoController(service) {
    async function list(req, res) {
        // Takes the validated query that the validation middleware validated and placed in req.validated
        // Takes that and passes it to service.listTodos
        const todos = await service.listTodos(req.validated.query); // This goes to service --> repository and then back to controller
        res.json({ data: todos }); // Now controller returns the json response
    }

    async function getById(req, res) {
        const todo = await service.getTodo(req.validated.params.todoId);
        res.json({ data: todo });
    }

    async function create(req, res) {
        const todo = await service.createTodo(req.validated.body);
        res.status(201).json({ data: todo });
    }

    async function update(req, res) {
        const todo = await service.updateTodo(
            req.validated.params.todoId,
            req.validated.body
        );
        res.json({ data: todo });
    }

    async function remove(req, res) {
        await service.deleteTodo(req.validated.params.todoId);
        res.status(204).send();
    }

    return {
        list,
        getById,
        create,
        update,
        remove
    };
}
