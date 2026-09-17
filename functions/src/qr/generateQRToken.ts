import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import { getAdminDb, COLLECTIONS, type QRAction, type QRExpirationSeconds } from '../config';
import { logAction } from '../audit/auditLog';
import { assertRole } from '../utils/helpers';
import { Timestamp } from 'firebase-admin/firestore';

const QR_ACTIONS: readonly QRAction[] = ['time_in', 'time_out'] as const;
const QR_EXPIRATION_OPTIONS: readonly QRExpirationSeconds[] = [30, 60, 120, 300] as const;

function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

function generateQRCodeDataUrl(token: string): string {
  const qrText = `INTERNO:${token}`;
  return `data:text/plain,${encodeURIComponent(qrText)}`;
}

export interface GenerateQRTokenRequest {
  action: QRAction;
  expirationSeconds?: QRExpirationSeconds;
}

export interface GenerateQRTokenResponse {
  token: string;
  qrDataUrl: string;
  expiresAt: number;
  sessionId: string;
}

export async function generateQRTokenHandler(
  request: CallableRequest<GenerateQRTokenRequest>
): Promise<GenerateQRTokenResponse> {
  const callerUid = assertRole(request.auth, ['admin', 'supervisor']);

  const callerRole = request.auth?.token?.role as string | undefined;
  const callerCompanyId = request.auth?.token?.companyId as string | undefined;

  if (!callerCompanyId) {
    throw new HttpsError('invalid-argument', 'Caller missing companyId in custom claims');
  }

  const { action, expirationSeconds } = request.data;

  if (!QR_ACTIONS.includes(action)) {
    throw new HttpsError('invalid-argument', `Invalid action: ${action}. Must be one of: ${QR_ACTIONS.join(', ')}`);
  }

  const expSeconds = QR_EXPIRATION_OPTIONS.includes(expirationSeconds as QRExpirationSeconds)
    ? (expirationSeconds as QRExpirationSeconds)
    : 60;

  const jwtSecret = process.env.QR_JWT_SECRET;
  if (!jwtSecret) {
    throw new HttpsError('failed-precondition', 'QR_JWT_SECRET not configured');
  }

  const db = getAdminDb();
  const nowSec = Math.floor(Date.now() / 1000);
  const exp = nowSec + expSeconds;
  const nonce = generateNonce();

  const token = jwt.sign(
    {
      companyId: callerCompanyId,
      action,
      exp,
      nonce,
      iat: nowSec,
    },
    jwtSecret,
    { algorithm: 'HS256' }
  );

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const sessionRef = db.collection(COLLECTIONS.QR_SESSIONS).doc();
  await sessionRef.set({
    tokenHash,
    companyId: callerCompanyId,
    action,
    expiresAt: exp * 1000,
    createdBy: callerUid,
    used: false,
    createdAt: Timestamp.now(),
  });

  const qrDataUrl = generateQRCodeDataUrl(token);

  await logAction({
    userId: callerUid,
    action: 'create',
    entityType: 'qr_session',
    entityId: sessionRef.id,
    newValue: { action, expirationSeconds: expSeconds, companyId: callerCompanyId },
  });

  return {
    token,
    qrDataUrl,
    expiresAt: exp * 1000,
    sessionId: sessionRef.id,
  };
}
