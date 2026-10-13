import express from "express";

const app = express();
const port = 3000;

// Parse incoming JSON bodies.
// The result becomes available as req.body.
app.use(express.json());

// Temporary in-memory data
let todos = [{ id: 1, title: "Learn Express", completed: false }];

// GET /api/todos
app.get(
    "/api/todos",

    (req, res) => {
        res.json(todos);
    }
);

// GET /api/todos/1
app.get("/api/todos/:id", (req, res) => {
    const id = Number(req.params.id);
    const todo = todos.find((item) => item.id === id);

    if (!todo) {
        return res.status(404).json({ error: "Todo not found" });
    }

    res.json(todo);
});

// POST /api/todos
app.post("/api/todos", (req, res) => {
    const todo = {
        id: Date.now(),
        title: req.body.title,
        completed: false
    };

    todos.push(todo);
    res.status(201).json(todo);
});

app.patch("/api/todos/:id", async (req, res) => {
    // Check authentication
    // Validate input
    // Perform application logic
    // Send response
});

// Error-handling middleware goes last
app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
