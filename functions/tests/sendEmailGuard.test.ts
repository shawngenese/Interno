import { assertCanSendEmail, EMAIL_SENDER_ROLES } from '../src/notifications/sendEmail';

describe('assertCanSendEmail role guard (FIX-13)', () => {
  it('includes coordinator in the allowed roles', () => {
    expect([...EMAIL_SENDER_ROLES]).toEqual(['admin', 'supervisor', 'coordinator']);
  });

  it.each(['admin', 'supervisor', 'coordinator'])('allows %s', (role) => {
    expect(() => assertCanSendEmail(role)).not.toThrow();
  });

  it.each([['trainee'], [''], [undefined]])('denies %s', (role) => {
    try {
      assertCanSendEmail(role as string | undefined);
      throw new Error('expected assertCanSendEmail to throw');
    } catch (err) {
      const e = err as { code?: string; message?: string };
      expect(e.code).toBe('permission-denied');
      expect(e.message).toContain('coordinator');
    }
  });

  it('denies unknown roles', () => {
    try {
      assertCanSendEmail('superuser');
      throw new Error('expected assertCanSendEmail to throw');
    } catch (err) {
      expect((err as { code?: string }).code).toBe('permission-denied');
    }
  });
});
