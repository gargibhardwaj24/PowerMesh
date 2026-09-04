import type { JobStatus } from "../../contracts/src/index.js";
import { AppError } from "./errors.js";

const ALLOWED_TRANSITIONS: Readonly<Record<JobStatus, readonly JobStatus[]>> = {
  SUBMITTED: ["QUEUED", "AWAITING_APPROVAL", "CANCELLED", "EXPIRED"],
  QUEUED: ["AWAITING_APPROVAL", "CANCELLED", "EXPIRED"],
  AWAITING_APPROVAL: ["APPROVED", "REJECTED", "CANCELLED", "KILLED", "EXPIRED"],
  APPROVED: ["RUNNING", "CANCELLED", "KILLED", "EXPIRED"],
  RUNNING: ["COMPLETED", "FAILED", "CANCELLED", "KILLED"],
  COMPLETED: [],
  FAILED: [],
  REJECTED: [],
  CANCELLED: [],
  KILLED: [],
  EXPIRED: []
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: JobStatus, to: JobStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError(409, "INVALID_JOB_TRANSITION", `Cannot transition a job from ${from} to ${to}`);
  }
}
