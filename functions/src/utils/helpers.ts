import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { z } from 'zod';

export function assertAuthenticated(auth: CallableRequest['auth']): string {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }
  return auth.uid;
}

export function assertRole(auth: CallableRequest['auth'], allowedRoles: string[]): string {
  const uid = assertAuthenticated(auth);
  const role = auth?.token?.role as string | undefined;

  if (!role || !allowedRoles.includes(role)) {
    throw new HttpsError('permission-denied', `Required role: ${allowedRoles.join(' or ')}`);
  }

  return uid;
}

export function assertAdmin(auth: CallableRequest['auth']): string {
  return assertRole(auth, ['admin']);
}

export function assertSupervisorOrAdmin(auth: CallableRequest['auth']): string {
  return assertRole(auth, ['admin', 'supervisor']);
}

export function assertCoordinatorOrAbove(auth: CallableRequest['auth']): string {
  return assertRole(auth, ['admin', 'supervisor', 'coordinator']);
}

export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    throw new HttpsError('invalid-argument', `Validation failed: ${errors}`);
  }
  return result.data;
}

export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function generateCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

export function sanitizeForAudit(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization', 'cookie'];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForAudit(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 100
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 100;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

export function getCurrentTimestamp(): number {
  return Date.now();
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}