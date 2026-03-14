import { ApiError } from "@zebra/core";

export class AppError extends ApiError {
  public code?: string;
  public isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    isOperational = true,
  ) {
    super(message, statusCode, { code, isOperational });
    this.name = this.constructor.name;
    this.code = code;
    this.isOperational = isOperational;
  }

  get statusCode() {
    return this.status;
  }
}

export const isAbortError = (err: unknown): boolean =>
  (err instanceof DOMException && err.name === "AbortError") ||
  (err instanceof Error && err.name === "AbortError");

export const createMaskedError = (
  err: unknown,
  defaultMessage: string = "An unexpected error occurred.",
): AppError | DOMException => {
  if (err instanceof AppError) {
    return err;
  }

  // Re-throw AbortError as-is so callers can filter it without unwrapping
  if (isAbortError(err)) {
    return err as DOMException;
  }

  // Log the original error internally for debugging, but don't expose it to the UI
  console.error("[Internal Error Log]:", err);

  return new AppError(defaultMessage, 500, "INTERNAL_ERROR", false);
};
