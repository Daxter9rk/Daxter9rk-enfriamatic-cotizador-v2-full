import {HttpsError} from 'firebase-functions/v2/https';
import type {ZodError} from 'zod';

export function invalidArgument(error: ZodError): HttpsError {
  return new HttpsError('invalid-argument', 'The submitted data is invalid.', {
    fields: error.issues.map((issue) => issue.path.join('.')).slice(0, 10),
  });
}

export function safeErrorCode(error: unknown): string {
  if (error instanceof HttpsError) return error.code;
  if (error instanceof Error && /^[a-z0-9-]{1,64}$/i.test(error.message)) {
    return error.message;
  }
  return 'internal';
}
