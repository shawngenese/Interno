export interface CoordinatorTrainee {
  traineeId: string;
  userId: string;
  name: string;
  email: string;
  departmentId?: string;
  supervisorId?: string;
  companyId: string;
  status: 'active' | 'inactive' | 'completed';
  startDate?: number;
  endDate?: number;
  ojtHoursRequired: number;
  ojtHoursCompleted: number;
}

export interface CoordinatorAttendanceSummary {
  traineeId: string;
  traineeName: string;
  totalDays: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalLateMinutes: number;
  totalUndertimeMinutes: number;
}

export interface CoordinatorTaskSummary {
  traineeId: string;
  traineeName: string;
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  submittedTasks: number;
  approvedTasks: number;
  returnedTasks: number;
  overdueTasks: number;
}

export interface CoordinatorDocumentSummary {
  traineeId: string;
  traineeName: string;
  totalDocuments: number;
  pendingDocuments: number;
  approvedDocuments: number;
  rejectedDocuments: number;
  missingRequired: string[];
}

export interface CoordinatorDashboardData {
  trainees: CoordinatorTrainee[];
  attendance: CoordinatorAttendanceSummary[];
  tasks: CoordinatorTaskSummary[];
  documents: CoordinatorDocumentSummary[];
  ojtProgress: {
    traineeId: string;
    traineeName: string;
    required: number;
    completed: number;
    remaining: number;
    percentComplete: number;
  }[];
}
