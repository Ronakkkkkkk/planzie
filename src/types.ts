/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  username: string;
  passwordHash: string;
  securityQuestion: string;
  securityAnswerHash: string;
}

export interface Task {
  id: string;
  username: string;
  title: string;
  deadline: string; // ISO string
  effort: number; // hours
  priority: 'High' | 'Medium' | 'Low';
  category: string;
  percentComplete: number; // 0 to 100
  createdAt: string; // ISO string
  escalationLevel: 'on_track' | 'gentle_reminder' | 'urgent_push' | 'autonomous_action';
  draftRequestingMoreTime?: string;
  draftMinimumViablePlan?: string;
  draftApproved?: boolean;
}

export interface Habit {
  id: string;
  username: string;
  title: string;
  streak: number;
  lastCompletedDate: string; // YYYY-MM-DD (local date)
  createdAt: string; // ISO string
}

export interface Feedback {
  id: string;
  username: string;
  text: string;
  createdAt: string; // ISO string;
}
