export class AppError extends Error {
    readonly statusCode: number;
    readonly details?: unknown;
    readonly code: string;

    constructor(statusCode: number, message: string, details?: unknown, code = "REQUEST_FAILED") {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
        this.details = details;
        this.code = code;
    }
}
