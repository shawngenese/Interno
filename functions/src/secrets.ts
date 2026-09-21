import { defineSecret } from 'firebase-functions/params';

export const qrJwtSecret = defineSecret('QR_JWT_SECRET');
