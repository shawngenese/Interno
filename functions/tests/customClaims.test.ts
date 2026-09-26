import { setUserRoleHandler, type SetUserRoleRequest } from '../src/auth/customClaims';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { getAdminAuth, getAdminDb } from '../src/config';
import { logAction } from '../src/audit/auditLog';

jest.mock('../src/config', () => ({
  ROLES: ['admin', 'supervisor', 'coordinator', 'trainee'],
  COLLECTIONS: { USERS: 'users' },
  getAdminAuth: jest.fn(),
  getAdminDb: jest.fn(),
}));

jest.mock('../src/audit/auditLog', () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
  deepClean: (value: unknown) => value,
}));

const mockAuth = {
  getUser: jest.fn(),
  setCustomUserClaims: jest.fn().mockResolvedValue(undefined),
};
const mockCallerDocGet = jest.fn();

function makeRequest(
  data: Record<string, unknown>,
  auth?: { uid: string; token: Record<string, unknown> }
): CallableRequest<SetUserRoleRequest> {
  return {
    data,
    auth,
    rawRequest: { headers: {} },
  } as unknown as CallableRequest<SetUserRoleRequest>;
}

function coordinatorCaller(companyId?: string) {
  const token: Record<string, unknown> = { role: 'coordinator' };
  if (companyId !== undefined) token.companyId = companyId;
  return { uid: 'coord-uid', token };
}

async function expectPermissionDenied(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    throw new Error('expected promise to reject');
  } catch (err) {
    const e = err as { code?: string; message?: string };
    expect(e.code).toBe('permission-denied');
    return e.message || '';
  }
}

describe('setUserRoleHandler companyId tenant scoping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (getAdminAuth as unknown as jest.Mock).mockReturnValue(mockAuth);
    (getAdminDb as unknown as jest.Mock).mockReturnValue({
      collection: () => ({ doc: () => ({ get: mockCallerDocGet }) }),
    });
    mockAuth.getUser.mockResolvedValue({ uid: 'target-uid', customClaims: {} });
    mockCallerDocGet.mockResolvedValue({ exists: false, data: () => undefined });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('rejects unauthenticated callers', async () => {
    await expect(
      setUserRoleHandler(makeRequest({ uid: 'target-uid', role: 'trainee' }, undefined))
    ).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  describe('admin callers (unchanged)', () => {
    it('may assign any role to any company', async () => {
      const res = await setUserRoleHandler(
        makeRequest(
          { uid: 'target-uid', role: 'trainee', companyId: 'other-company' },
          { uid: 'admin-uid', token: { role: 'admin', companyId: 'my-company' } }
        )
      );
      expect(res).toEqual({ success: true, role: 'trainee' });
      expect(mockAuth.setCustomUserClaims).toHaveBeenCalledWith(
        'target-uid',
        expect.objectContaining({ role: 'trainee', companyId: 'other-company' })
      );
      expect(logAction).toHaveBeenCalled();
    });

    it('may assign non-trainee roles', async () => {
      const res = await setUserRoleHandler(
        makeRequest(
          { uid: 'target-uid', role: 'coordinator' },
          { uid: 'admin-uid', token: { role: 'admin' } }
        )
      );
      expect(res.success).toBe(true);
    });
  });

  describe('coordinator callers', () => {
    it('may assign a trainee role within their own company', async () => {
      const res = await setUserRoleHandler(
        makeRequest(
          { uid: 'target-uid', role: 'trainee', companyId: 'co-1', traineeId: 't-1' },
          coordinatorCaller('co-1')
        )
      );
      expect(res).toEqual({ success: true, role: 'trainee' });
      expect(mockAuth.setCustomUserClaims).toHaveBeenCalledWith(
        'target-uid',
        expect.objectContaining({ role: 'trainee', companyId: 'co-1', traineeId: 't-1' })
      );
    });

    it('may NOT assign a trainee role to a different company', async () => {
      const message = await expectPermissionDenied(
        setUserRoleHandler(
          makeRequest(
            { uid: 'target-uid', role: 'trainee', companyId: 'other-company' },
            coordinatorCaller('co-1')
          )
        )
      );
      expect(message).toContain('their own company');
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
      expect(logAction).not.toHaveBeenCalled();
    });

    it('may NOT omit companyId (would silently inherit an existing claim)', async () => {
      await expectPermissionDenied(
        setUserRoleHandler(
          makeRequest({ uid: 'target-uid', role: 'trainee' }, coordinatorCaller('co-1'))
        )
      );
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it('falls back to the caller Firestore doc when the companyId claim is missing', async () => {
      mockCallerDocGet.mockResolvedValue({
        exists: true,
        data: () => ({ companyId: 'co-1' }),
      });
      const res = await setUserRoleHandler(
        makeRequest({ uid: 'target-uid', role: 'trainee', companyId: 'co-1' }, coordinatorCaller())
      );
      expect(res.success).toBe(true);
      expect(mockCallerDocGet).toHaveBeenCalled();
    });

    it('is denied when neither claim nor Firestore doc has a companyId', async () => {
      const message = await expectPermissionDenied(
        setUserRoleHandler(
          makeRequest({ uid: 'target-uid', role: 'trainee', companyId: 'co-1' }, coordinatorCaller())
        )
      );
      expect(message).toContain('no company assignment');
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it('may NOT assign non-trainee roles', async () => {
      await expectPermissionDenied(
        setUserRoleHandler(
          makeRequest({ uid: 'target-uid', role: 'supervisor' }, coordinatorCaller('co-1'))
        )
      );
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });
  });

  describe('other non-admin callers (unchanged)', () => {
    it('rejects supervisors trying to assign roles', async () => {
      await expectPermissionDenied(
        setUserRoleHandler(
          makeRequest(
            { uid: 'target-uid', role: 'trainee', companyId: 'co-1' },
            { uid: 'sup-uid', token: { role: 'supervisor', companyId: 'co-1' } }
          )
        )
      );
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it('rejects trainees trying to assign roles', async () => {
      await expectPermissionDenied(
        setUserRoleHandler(
          makeRequest(
            { uid: 'target-uid', role: 'trainee' },
            { uid: 'trainee-uid', token: { role: 'trainee' } }
          )
        )
      );
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it('rejects callers with no role claim', async () => {
      await expectPermissionDenied(
        setUserRoleHandler(
          makeRequest({ uid: 'target-uid', role: 'trainee', companyId: 'co-1' }, {
            uid: 'no-role-uid',
            token: {},
          })
        )
      );
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });
  });

  it('still rejects invalid roles before any role check', async () => {
    await expect(
      setUserRoleHandler(
        makeRequest({ uid: 'target-uid', role: 'superuser' }, coordinatorCaller('co-1'))
      )
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
  });
});
