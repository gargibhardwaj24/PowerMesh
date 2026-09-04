import { createHmac, timingSafeEqual } from "node:crypto";
import type { UserRole } from "../../contracts/src/index.js";
import { USER_ROLES } from "../../contracts/src/index.js";
import { AppError } from "./errors.js";

export interface SessionClaims {
  sub: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

const TOKEN_VERSION = "pm1";
const MINIMUM_SECRET_LENGTH = 32;

function base64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signature(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(`${TOKEN_VERSION}.${payload}`).digest();
}

export function assertAuthSecret(secret: string): void {
  if (secret.length < MINIMUM_SECRET_LENGTH) {
    throw new Error(`AUTH_SECRET must contain at least ${MINIMUM_SECRET_LENGTH} characters`);
  }
}

export function issueSessionToken(
  identity: Pick<SessionClaims, "sub" | "email" | "role">,
  secret: string,
  ttlSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1_000)
): string {
  assertAuthSecret(secret);
  const claims: SessionClaims = {
    ...identity,
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds
  };
  const payload = base64Url(JSON.stringify(claims));
  return `${TOKEN_VERSION}.${payload}.${signature(payload, secret).toString("base64url")}`;
}

function parseClaims(value: unknown): SessionClaims {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AppError(401, "INVALID_TOKEN", "Session token payload is invalid");
  }
  const claims = value as Record<string, unknown>;
  const role = claims["role"];
  if (
    typeof claims["sub"] !== "string" ||
    typeof claims["email"] !== "string" ||
    typeof claims["iat"] !== "number" ||
    typeof claims["exp"] !== "number" ||
    typeof role !== "string" ||
    !USER_ROLES.includes(role as UserRole)
  ) {
    throw new AppError(401, "INVALID_TOKEN", "Session token claims are invalid");
  }
  return {
    sub: claims["sub"],
    email: claims["email"],
    role: role as UserRole,
    iat: claims["iat"],
    exp: claims["exp"]
  };
}

export function verifySessionToken(
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1_000)
): SessionClaims {
  assertAuthSecret(secret);
  const [version, payload, encodedSignature, extra] = token.split(".");
  if (version !== TOKEN_VERSION || payload === undefined || encodedSignature === undefined || extra !== undefined) {
    throw new AppError(401, "INVALID_TOKEN", "Session token format is invalid");
  }
  const expected = signature(payload, secret);
  let received: Buffer;
  try {
    received = Buffer.from(encodedSignature, "base64url");
  } catch {
    throw new AppError(401, "INVALID_TOKEN", "Session token signature is invalid");
  }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new AppError(401, "INVALID_TOKEN", "Session token signature is invalid");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
  } catch {
    throw new AppError(401, "INVALID_TOKEN", "Session token payload is invalid");
  }
  const claims = parseClaims(parsed);
  if (claims.exp <= nowSeconds) throw new AppError(401, "TOKEN_EXPIRED", "Session token has expired");
  return claims;
}

