export class InsufficientBalanceError extends Error {}
export class EmergencyStoppedError extends Error {}
export class WorkerSuspendedError extends Error {}
export class OverLimitError extends Error {}
export class NegativeBalanceError extends Error {}
export class InvalidIdempotencyKeyError extends Error {
  readonly statusCode = 400
}
