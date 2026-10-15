export class AppError extends Error {
    constructor(
        readonly statusCode: number,
        message: string,
        readonly code: string,
        readonly retryAt?: Date
    ) {
        super(message);
        this.name = "AppError";
    }
}
