
import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError, z } from "zod";

// Generic HTTP error
export class HttpError extends Error {
  readonly status: number;
  readonly title: string;
  readonly type: string;
  readonly extensions: Record<string, unknown>;

  constructor(
    status: number,
    title: string,
    options: {
      detail?: string;
      type?: string;
      extensions?: Record<string, unknown>;
    } = {}
  ) {
    super(options.detail ?? title);

    this.name = "HttpError";
    this.status = status;
    this.title = title;
    this.type = options.type ?? "about:blank";
    this.extensions = options.extensions ?? {};

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// Centralized Express error handler
export const errorHandler: ErrorRequestHandler = (
  err,
  req,
  res,
  _next
) => {
  // Convert Zod validation errors into HTTP 400
  if (err instanceof ZodError) {
    err = new HttpError(400, "Validation failed", {
      type: "https://shopsphere.dev/errors/validation",
      extensions: {
        errors: err.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
    });
  }

  // Determine HTTP status
  const known = err instanceof HttpError;

  // Errors raised by Express itself (e.g. invalid JSON body, body too large) carry a 4xx `status`.
  const expressStatus =
    typeof err?.status === "number" && err.status >= 400 && err.status < 500 ? err.status : undefined;

  const status = known ? err.status : (expressStatus ?? 500);

  const title = known
    ? err.title
    : expressStatus
      ? String(err.message)
      : "Internal Server Error";

  const detail = known
    ? err.message
    : expressStatus
      ? undefined
      : "An unexpected error occurred";   // never leak internal messages or stack traces

  const type = known
    ? err.type
    : "about:blank";

  // Unexpected failures are logged with the full error (and request id) for debugging.
  if (status >= 500) req.log?.error({ err }, "request failed");

  // Return RFC 9457-style Problem Details
  res
    .status(status)
    .type("application/problem+json")
    .json({
      type,
      title,
      status,
      ...(detail ? { detail } : {}),
      instance: req.originalUrl,
      requestId: req.id,
      ...(known ? err.extensions : {}),
    });
};

// Unknown routes become a 404 Problem Details response (mounted after all routers in http.ts)
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, "Not Found"));
};

// Generic Zod validation helper
export const validate = <S extends z.ZodType>(
  schema: S,
  value: unknown
): z.infer<S> => {
  return schema.parse(value);
};




// import type { ErrorRequestHandler, RequestHandler } from "express";

// /** Throw this from any route. It becomes an RFC 9457 Problem Details response. */
// export class HttpError extends Error {
//   readonly status: number;
//   readonly title: string;
//   readonly type: string;
//   readonly detail: string | undefined;

//   constructor(status: number, title: string, options: { detail?: string; type?: string } = {}) {
//     super(options.detail ?? title);
//     this.status = status;
//     this.title = title;
//     this.detail = options.detail;
//     this.type = options.type ?? "about:blank";
//   }
// }

// export const notFoundHandler: RequestHandler = (_req, _res, next) => {
//   next(new HttpError(404, "Not Found"));
// };

// export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
//   const known = err instanceof HttpError;
//   // Errors raised by Express itself (e.g. an invalid JSON body) carry a `status` field.
//   const status = known
//     ? err.status
//     : typeof err?.status === "number" && err.status >= 400 && err.status < 600
//       ? err.status
//       : 500;

//   if (status >= 500) req.log.error({ err }, "request failed");

//   res
//     .status(status)
//     .type("application/problem+json")
//     .json({
//       type: known ? err.type : "about:blank",
//       title: known ? err.title : status >= 500 ? "Internal Server Error" : String(err.message),
//       status,
//       ...(known && err.detail ? { detail: err.detail } : {}),
//       instance: req.originalUrl,
//       requestId: req.id,
//     });
// };
