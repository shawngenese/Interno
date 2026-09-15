export type DTRStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'corrected';

export interface DTREntry {
  id: string;
  traineeId: string;
  date: number;                // day start epoch ms
  companyId: string;
  scheduleId: string;
  // Raw
  actualTimeIn?: number;
  actualTimeOut?: number;
  // Calculated
  scheduledTimeIn: number;
  scheduledTimeOut: number;
  scheduledBreakMinutes: number;
  scheduledWorkMinutes: number;
  actualWorkMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  undertimeMinutes: number;
  nightDiffMinutes: number;
  isHoliday: boolean;
  holidayName?: string;
  status: DTRStatus;
  // Metadata
  createdAt: number;
  updatedAt: number;
  approvedAt?: number;
  approvedBy?: string;
  correctionRequestId?: string;
}

export interface DTRCorrectionRequest {
  id: string;
  dtrId: string;
  traineeId: string;
  requestedBy: string;
  reason: string;
  originalValue: Partial<DTREntry>;
  proposedValue: Partial<DTREntry>;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: number;
  reviewNotes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DTRSummary {
  traineeId: string;
  periodStart: number;
  periodEnd: number;
  totalDays: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalLateMinutes: number;
  totalUndertimeMinutes: number;
  totalNightDiffHours: number;
  entries: DTREntry[];
}

export interface CalculateDTRParams {
  traineeId: string;
  startDate: number;
  endDate: number;
  forceRecalc?: boolean;
}

export interface CalculateDTRResult {
  success: boolean;
  calculated: number;
  dtrs: DTREntry[];
}

export interface ListDTRParams {
  page?: number;
  limit?: number;
  traineeId?: string;
  status?: DTRStatus;
  startDate?: number;
  endDate?: number;
  companyId?: string;
}

export interface PaginatedDTRResponse {
  data: DTREntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}