import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';
import { getAdminAuth, getAdminDb, COLLECTIONS } from '../config';
import { sendEmailMessage } from './sendEmail';
import { logAction } from '../audit/auditLog';

export interface SendSupervisorInviteRequest {
  companyId: string;
  supervisorName: string;
  supervisorEmail: string;
}

export interface SendSupervisorInviteResponse {
  success: boolean;
  invitationId: string;
  accountCreated: boolean;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_APP_URL = 'https://interno-cec9f.web.app';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPasswordEmail(supervisorName: string, companyName: string, resetLink: string): string {
  const safeName = escapeHtml(supervisorName);
  const safeCompany = escapeHtml(companyName);
  const safeLink = escapeHtml(resetLink);
  return `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
    <h2 style="font-size: 20px; margin-bottom: 16px;">Welcome to Interno</h2>
    <p>Hello ${safeName},</p>
    <p>You have been invited to join <strong>Interno</strong> as an external supervisor for <strong>${safeCompany}</strong>.</p>
    <p>As a supervisor you can review trainee attendance, approve time logs, and submit evaluations for trainees placed at your company.</p>
    <p style="margin: 28px 0;">
      <a href="${safeLink}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; display: inline-block; font-weight: bold;">Set Your Password</a>
    </p>
    <p>Or copy this link: <a href="${safeLink}">${safeLink}</a></p>
    <p style="color: #6b7280; font-size: 13px;">This link expires in 1 hour. If it has expired, ask the coordinator to resend your invitation. If you were not expecting this invitation, you can ignore this email.</p>
  </body>
</html>`;
}

function buildPasswordEmailText(supervisorName: string, companyName: string, resetLink: string): string {
  return [
    `Hello ${supervisorName},`,
    '',
    `You have been invited to join Interno as an external supervisor for ${companyName}.`,
    '',
    'Set your password to activate your account:',
    resetLink,
    '',
    'This link expires in 1 hour. If it has expired, ask the coordinator to resend your invitation.',
    'If you were not expecting this invitation, you can ignore this email.',
  ].join('\n');
}

export async function sendSupervisorInviteHandler(
  request: CallableRequest<SendSupervisorInviteRequest>
): Promise<SendSupervisorInviteResponse> {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const role = request.auth.token?.role as string | undefined;
  if (role !== 'coordinator' && role !== 'admin') {
    throw new HttpsError('permission-denied', 'Required role: coordinator or admin');
  }

  const { companyId, supervisorName, supervisorEmail } = request.data ?? ({} as SendSupervisorInviteRequest);

  if (!companyId || typeof companyId !== 'string') {
    throw new HttpsError('invalid-argument', 'companyId is required');
  }
  if (!supervisorName || typeof supervisorName !== 'string' || !supervisorName.trim()) {
    throw new HttpsError('invalid-argument', 'supervisorName is required');
  }
  if (!supervisorEmail || typeof supervisorEmail !== 'string' || !EMAIL_REGEX.test(supervisorEmail)) {
    throw new HttpsError('invalid-argument', 'supervisorEmail must be a valid email');
  }

  const db = getAdminDb();
  const auth = getAdminAuth();
  const email = supervisorEmail.trim();
  const name = supervisorName.trim();

  const companySnap = await db.collection(COLLECTIONS.COMPANIES).doc(companyId).get();
  if (!companySnap.exists) {
    throw new HttpsError('not-found', 'Company not found');
  }
  const companyData = companySnap.data();
  if (companyData?.type !== 'external' || companyData?.verified !== true) {
    throw new HttpsError('permission-denied', 'Invites can only be sent to verified external companies');
  }
  const companyName = (companyData?.name as string | undefined) ?? companyId;

  // Provision the supervisor account (Option B): create Auth user + users doc +
  // custom claims if the email is new; if the account already exists, only
  // refresh their password-set link. Role/company conflicts are rejected.
  let uid: string;
  let accountCreated = false;

  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    const claims = (existing.customClaims ?? {}) as Record<string, unknown>;
    const userDoc = await db.collection(COLLECTIONS.USERS).doc(uid).get();
    const docData = userDoc.exists ? userDoc.data() : undefined;
    const existingRole = (claims.role as string | undefined) ?? (docData?.role as string | undefined);
    const existingCompanyId = (claims.companyId as string | undefined) ?? (docData?.companyId as string | undefined);

    if (existingRole && existingRole !== 'supervisor') {
      throw new HttpsError(
        'failed-precondition',
        `Email already has an account with role '${existingRole}' — ask an admin to change the role instead of inviting`
      );
    }
    if (existingCompanyId && existingCompanyId !== companyId) {
      throw new HttpsError(
        'failed-precondition',
        'This supervisor already belongs to a different company'
      );
    }
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    const code = (err as { code?: string }).code;
    if (code !== 'auth/user-not-found') {
      console.error('Failed to look up invitee:', err);
      throw new HttpsError('internal', 'Failed to check invitee account');
    }

    const tempPassword = randomBytes(24).toString('base64url');
    const created = await auth.createUser({ email, password: tempPassword, displayName: name });
    uid = created.uid;
    accountCreated = true;

    await db.collection(COLLECTIONS.USERS).doc(uid).set({
      email,
      displayName: name,
      role: 'supervisor',
      companyId,
      status: 'active',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    await auth.setCustomUserClaims(uid, { role: 'supervisor', companyId, updatedAt: Date.now() });
  }

  const appUrl = (process.env.APP_URL || DEFAULT_APP_URL).replace(/\/+$/, '');
  const resetLink = await auth.generatePasswordResetLink(email, { url: `${appUrl}/login` });

  const emailResult = await sendEmailMessage({
    to: email,
    subject: 'Set your password — Interno external supervisor invitation',
    html: buildPasswordEmail(name, companyName, resetLink),
    text: buildPasswordEmailText(name, companyName, resetLink),
  });

  const invitationRef = await db.collection(COLLECTIONS.SUPERVISOR_INVITATIONS).add({
    companyId,
    supervisorName: name,
    supervisorEmail: email,
    companyName,
    status: 'pending',
    uid,
    accountCreated,
    emailId: emailResult.id,
    createdBy: request.auth.uid,
    createdAt: Timestamp.now(),
  });

  try {
    await logAction({
      userId: request.auth.uid,
      action: 'create',
      entityType: 'supervisor',
      entityId: invitationRef.id,
      newValue: { companyId, supervisorName: name, supervisorEmail: email, uid, accountCreated },
      metadata: { via: 'sendSupervisorInvite', emailId: emailResult.id },
    });
  } catch (auditErr) {
    console.warn('Audit logging failed (non-fatal, invite was created):', auditErr);
  }

  return { success: true, invitationId: invitationRef.id, accountCreated };
}
