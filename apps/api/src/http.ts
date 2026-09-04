import type { IncomingMessage, ServerResponse } from "node:http";
import { AppError } from "../../../packages/core/src/errors.js";

export interface ApiEnvelope<T> {
  data: T;
  requestId: string;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: readonly string[];
  };
}

export async function readJsonBody(request: IncomingMessage, maxBodyBytes: number): Promise<unknown> {
  const contentType = request.headers["content-type"];
  if (typeof contentType !== "string" || !contentType.toLowerCase().startsWith("application/json")) {
    throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json");
  }
  const chunks: Buffer[] = [];
  let receivedBytes = 0;
  try {
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      receivedBytes += buffer.byteLength;
      if (receivedBytes > maxBodyBytes) {
        throw new AppError(413, "PAYLOAD_TOO_LARGE", `Request body exceeds ${maxBodyBytes} bytes`);
      }
      chunks.push(buffer);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, "BODY_READ_FAILED", "Request body could not be read");
  }
  if (receivedBytes === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new AppError(400, "INVALID_JSON", "Request body must contain valid JSON");
  }
}

export function sendJson<T>(response: ServerResponse, statusCode: number, body: T): void {
  if (response.headersSent) return;
  const serialized = JSON.stringify(body);
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Content-Length", Buffer.byteLength(serialized));
  response.end(serialized);
}

export function sendData<T>(response: ServerResponse, requestId: string, statusCode: number, data: T): void {
  sendJson<ApiEnvelope<T>>(response, statusCode, { data, requestId });
}

export function sendError(response: ServerResponse, requestId: string, error: unknown): void {
  const appError =
    error instanceof AppError
      ? error
      : new AppError(500, "INTERNAL_ERROR", "An unexpected server error occurred");
  const payload: ErrorEnvelope = {
    error: {
      code: appError.code,
      message: appError.message,
      requestId,
      ...(appError.details === undefined ? {} : { details: appError.details })
    }
  };
  sendJson(response, appError.statusCode, payload);
}

export function requireHeader(request: IncomingMessage, name: string): string {
  const value = request.headers[name.toLowerCase()];
  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError(401, "MISSING_CREDENTIALS", `Missing ${name} header`);
  }
  return value.trim();
}

export function readBearerToken(request: IncomingMessage): string {
  const authorization = requireHeader(request, "authorization");
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (match?.[1] === undefined) throw new AppError(401, "INVALID_AUTHORIZATION", "Authorization must use Bearer scheme");
  return match[1];
}
