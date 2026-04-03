export class ConfigError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export class AuthError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export class ZenTaoApiError extends Error {
  public readonly code?: string | number;
  public readonly status?: string | number;
  public readonly details?: unknown;

  public constructor(message: string, options?: { code?: string | number; status?: string | number; details?: unknown }) {
    super(message);
    this.name = "ZenTaoApiError";
    this.code = options?.code;
    this.status = options?.status;
    this.details = options?.details;
  }
}

export function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
