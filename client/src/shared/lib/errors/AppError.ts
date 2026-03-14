export class AppError extends Error {
  public statusCode?: number;
  public code?: string;
  public isOperational: boolean;

  constructor(
    message: string,
    statusCode?: number,
    code?: string,
    isOperational = true,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export const createMaskedError = (
  err: unknown,
  defaultMessage: string = "An unexpected error occurred.",
): AppError => {
  if (err instanceof AppError) {
    return err;
  }

  // Log the original error internally for debugging, but don't expose it to the UI
  console.error("[Internal Error Log]:", err);

  return new AppError(defaultMessage, 500, "INTERNAL_ERROR", false);
};
