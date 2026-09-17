export type EvaluationType = 'monthly' | 'midterm' | 'final' | 'periodic';

export type EvaluationStatus = 'draft' | 'submitted' | 'reviewed' | 'finalized';

export type RatingScale = 1 | 2 | 3 | 4 | 5;

export interface EvaluationRating {
  category: string;
  rating: RatingScale;
  comments?: string;
}

export interface Evaluation {
  id: string;
  traineeId: string;
  traineeName: string;
  supervisorId: string;
  supervisorName: string;
  companyId: string;
  type: EvaluationType;
  status: EvaluationStatus;
  period: {
    startDate: number;
    endDate: number;
  };
  ratings: EvaluationRating[];
  overallComments?: string;
  overallRating?: number;
  reviewedBy?: string;
  reviewedAt?: number;
  reviewComments?: string;
  finalizedBy?: string;
  finalizedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface EvaluationFormData {
  traineeId: string;
  traineeName: string;
  supervisorId: string;
  supervisorName: string;
  companyId: string;
  type: EvaluationType;
  status: EvaluationStatus;
  period: {
    startDate: number;
    endDate: number;
  };
  ratings: EvaluationRating[];
  overallComments?: string;
  overallRating?: number;
}

export const EVALUATION_CATEGORIES = [
  'Technical Skills',
  'Communication',
  'Teamwork',
  'Problem Solving',
  'Time Management',
  'Professionalism',
  'Initiative',
  'Adaptability',
] as const;

export const EVALUATION_TYPE_LABELS: Record<EvaluationType, string> = {
  monthly: 'Monthly Evaluation',
  midterm: 'Midterm Evaluation',
  final: 'Final Evaluation',
  periodic: 'Periodic Evaluation',
};

export const RATING_LABELS: Record<RatingScale, string> = {
  1: 'Needs Improvement',
  2: 'Below Expectations',
  3: 'Meets Expectations',
  4: 'Exceeds Expectations',
  5: 'Outstanding',
};
