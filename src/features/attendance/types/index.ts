export type QRAction = 'time_in' | 'time_out';

export type QRExpirationSeconds = 30 | 60 | 120 | 300;

export interface QRTokenPayload {
  companyId: string;
  action: QRAction;
  exp: number;      // expiration timestamp (seconds)
  nonce: string;    // random 16-char string
  iat: number;      // issued at (seconds)
}

export interface QRSession {
  id: string;
  companyId: string;
  action: QRAction;
  expiresAt: number;    // epoch ms
  createdBy: string;    // supervisor uid
  used: boolean;
  usedAt?: number;
  usedBy?: string;
  createdAt: { seconds: number; nanoseconds: number };
}

export interface AttendanceRecord {
  id: string;
  traineeId: string;
  type: QRAction;
  timestamp: number;    // epoch ms
  qrSessionId: string;
  deviceInfo?: Record<string, unknown>;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  createdAt: { seconds: number; nanoseconds: number };
}

export interface GenerateQRResult {
  token: string;
  qrDataUrl: string;
  expiresAt: number;
  sessionId: string;
}

export interface ValidateQRResult {
  success: boolean;
  action: QRAction;
  timestamp: number;
  attendanceId: string;
  message: string;
}

export interface TodayAttendanceStatus {
  hasTimeIn: boolean;
  hasTimeOut: boolean;
  timeInRecord?: AttendanceRecord;
  timeOutRecord?: AttendanceRecord;
}

export interface ListAttendanceParams {
  page?: number;
  limit?: number;
  startDate?: number;
  endDate?: number;
}

export interface PaginatedAttendanceResponse {
  data: AttendanceRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}