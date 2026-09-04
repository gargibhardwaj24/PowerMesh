export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: readonly string[];

  constructor(statusCode: number, code: string, message: string, details?: readonly string[]) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

