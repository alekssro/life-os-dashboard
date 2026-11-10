export type FocusMode = 'ALL' | 'DEEP_WORK' | 'HOMELAB' | 'PERSONAL';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'WAITING' | 'DONE' | 'CANCELLED';
export type TaskPriority = 'TOP_3' | 'HIGH' | 'NORMAL' | 'LOW';

export interface Task {
  id: string;
  title: string;
  notes?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  dueTime?: string | null;
  reminderAt?: string | null;
  isTop3: boolean;
  starOrder?: number | null;
  isRecurring: boolean;
  recurrenceRule?: string | null;
  completedAt?: string | null;
  source: string;
  superlistId?: string | null;
  superlistListId?: string | null;
  superlistUrl?: string | null;
  domainId?: string | null;
  projectId?: string | null;
  domain?: {
    id: string;
    name: string;
    slug: string;
    color?: string | null;
  } | null;
  project?: {
    id: string;
    title: string;
    superlistListId?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectedCalendar {
  id: string;
  name: string;
  type: string;
  feedUrl?: string | null;
  googleCalId?: string | null;
  color?: string | null;
  isActive: boolean;
  lastSyncedAt?: string | null;
}

export interface Event {
  id: string;
  title: string;
  startTime?: string | null;
  endTime?: string | null;
  date: string;
  location?: string | null;
  notes?: string | null;
  source: string;
  externalId?: string | null;
  calendarId?: string | null;
  calendar?: ConnectedCalendar | null;
  domainId?: string | null;
  domain?: {
    id: string;
    name: string;
    slug: string;
    color?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuickNote {
  id?: string;
  title?: string;
  content: string;
  tags?: string[];
  vaultPath?: string;
  folder?: string;
  timestamp: string;
}

export interface RoutineLog {
  id: string;
  routineId: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  completedAt: string;
  loggedAt: string;
}

export interface Routine {
  id: string;
  title: string;
  timeOfDay: 'MORNING' | 'AFTERNOON' | 'EVENING';
  frequency: string;
  daysOfWeek?: string | null;
  dayOfMonth?: number | null;
  order: number;
  active: boolean;
  icon?: string | null;
  streak: number;
  bestStreak: number;
  lastCompletedDate?: string | null;
  /** Unit the streak is counted in: DAY, WEEK or MONTH (per frequency). */
  streakUnit?: 'DAY' | 'WEEK' | 'MONTH' | null;
  /** Human label, e.g. "3 weeks". */
  streakLabel?: string | null;
  /** Compact label, e.g. "3w". */
  streakShortLabel?: string | null;
  /** Plural unit name, e.g. "weeks". */
  streakUnitLabel?: string | null;
  /** The current period is still running and not completed yet. */
  atRisk?: boolean;
  /** Missed periods currently covered by grace. */
  graceUsed?: number;
  /** Whether the current period (day/week/month) is completed. */
  completedCurrentPeriod?: boolean;
  consistencyScore: number;
  graceDays: number;
  targetPerWeek: number;
  superlistId?: string | null;
  superlistListId?: string | null;
  superlistUrl?: string | null;
  isDueToday?: boolean;
  isCompletedToday?: boolean;
  logs?: RoutineLog[];
}

export interface HabitHistoryMap {
  [routineId: string]: {
    [dateStr: string]: boolean; // YYYY-MM-DD -> completed
  };
}

export interface HabitState {
  routines: Routine[];
  total: number;
  completedCount: number;
  todayStr: string;
  selectedDate: string; // YYYY-MM-DD
  history: HabitHistoryMap;
  viewMode: 'WEEK' | 'MONTH' | 'YEAR';
}

export interface Domain {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  color?: string | null;
  order: number;
  superlistListId?: string | null;
  superlistUrl?: string | null;
}
