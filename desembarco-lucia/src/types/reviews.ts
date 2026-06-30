// types/reviews.ts

export type ReviewStatus = "auto" | "escalated" | "pending";
export type Tone = "ember" | "moss" | "gold" | "wood";
export type Priority = "alta" | "media" | "baja";

export interface Review {
  id: string;
  authorName: string;
  authorInitial: string;
  rating: 1 | 2 | 3 | 4 | 5;
  branch: string;
  text: string;
  reply?: string;
  status: ReviewStatus;
  /** ISO timestamp of when the review was posted */
  postedAt: string;
  /** Display string like "hace 12 min" */
  relativeTime: string;
  escalation?: {
    assignedTo: string;
    /** SLA hours remaining */
    slaHoursLeft: number;
    priority?: Priority;
  };
}

export interface StatCard {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaDirection?: "up" | "down";
  tone: Tone;
}

export interface CmQueueItem {
  id: string;
  position: number;
  authorName: string;
  branch: string;
  rating: 1 | 2 | 3 | 4 | 5;
  preview: string;
  slaHoursLeft: number;
}

export interface BranchRanking {
  position: number;
  name: string;
  score: number;
  /** 0..100 percentage of bar fill */
  percent: number;
}

export interface DashboardData {
  stats: StatCard[];
  reviews: Review[];
  cmQueue: CmQueueItem[];
  branches: BranchRanking[];
  meta: {
    totalLocations: number;
    lastSync: string;
    operator: string;
    panelTimestamp: string;
  };
}
