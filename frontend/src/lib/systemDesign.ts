import { db } from './firebase/config';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';

export interface SystemDesignResource {
  role: string;
  type: string;
  match_type?: string;
  title: string;
  url: string;
}

export interface SystemDesignProblem {
  id: number;
  title: string;
  difficulty: number;
  problem_statement: string;
  tags: string[];
  resources: SystemDesignResource[];
  resource_note?: string;
}

export interface DailySystemDesignRecord {
  date: string;
  dayOfWeek: number;
  dayName: string;
  isSunday: boolean;
  problemIds: number[];
  problems: SystemDesignProblem[];
  selectedAt: string;
  isLocked?: boolean;
  unlocksAt?: string;
  serverTimeIST?: string;
}

export interface DifficultyConfig {
  label: string;
  color: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  gradient: string;
  badgeBg: string;
}

export const DIFFICULTY_CONFIG: Record<number, DifficultyConfig> = {
  0: {
    label: 'Foundational',
    color: '#10b981',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/25',
    textClass: 'text-emerald-400',
    gradient: 'from-emerald-500 to-teal-400',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
  },
  1: {
    label: 'Easy',
    color: '#0ea5e9',
    bgClass: 'bg-sky-500/10',
    borderClass: 'border-sky-500/25',
    textClass: 'text-sky-400',
    gradient: 'from-sky-500 to-blue-400',
    badgeBg: 'rgba(14, 165, 233, 0.15)',
  },
  2: {
    label: 'Medium',
    color: '#f59e0b',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/25',
    textClass: 'text-amber-400',
    gradient: 'from-amber-500 to-orange-400',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
  },
  3: {
    label: 'Hard',
    color: '#f97316',
    bgClass: 'bg-orange-500/10',
    borderClass: 'border-orange-500/25',
    textClass: 'text-orange-400',
    gradient: 'from-orange-500 to-red-400',
    badgeBg: 'rgba(249, 115, 22, 0.15)',
  },
  4: {
    label: 'Very Hard',
    color: '#f43f5e',
    bgClass: 'bg-rose-500/10',
    borderClass: 'border-rose-500/25',
    textClass: 'text-rose-400',
    gradient: 'from-rose-500 to-pink-500',
    badgeBg: 'rgba(244, 63, 94, 0.15)',
  },
  5: {
    label: 'Advanced',
    color: '#a855f7',
    bgClass: 'bg-purple-500/10',
    borderClass: 'border-purple-500/25',
    textClass: 'text-purple-400',
    gradient: 'from-purple-500 to-indigo-500',
    badgeBg: 'rgba(168, 85, 247, 0.15)',
  },
};

/**
 * Get current time details in Indian Standard Time (Asia/Kolkata).
 */
export function getISTTime() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const getPart = (t: string) => parts.find(p => p.type === t)?.value || '00';

  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  const hour = parseInt(getPart('hour'), 10);
  const minute = parseInt(getPart('minute'), 10);
  const second = parseInt(getPart('second'), 10);

  const dateStr = `${year}-${month}-${day}`;
  const isAfter6PM = hour >= 18;

  // Calculate seconds remaining until 18:00:00 IST today
  const secondsSinceMidnight = hour * 3600 + minute * 60 + second;
  const targetSeconds = 18 * 3600; // 18:00:00
  const secondsUntil6PM = Math.max(0, targetSeconds - secondsSinceMidnight);

  return {
    dateStr,
    hour,
    minute,
    second,
    isAfter6PM,
    secondsUntil6PM,
    formattedTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')} IST`,
  };
}

/**
 * Check if resources and tags are unlocked for a problem date.
 * - Past dates (< today in IST): UNLOCKED (already past 6 PM)
 * - Today in IST: UNLOCKED only if hour >= 18
 * - Future dates: LOCKED
 */
export function isResourcesUnlocked(problemDate: string): boolean {
  const ist = getISTTime();
  if (problemDate < ist.dateStr) return true;
  if (problemDate === ist.dateStr) return ist.isAfter6PM;
  return false;
}

/**
 * Format seconds into HH:MM:SS string.
 */
export function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

/**
 * Fetch today's system design problem:
 * Tries direct Firestore first, falls back to backend API if needed.
 */
export async function fetchTodaySystemDesign(): Promise<DailySystemDesignRecord | null> {
  const ist = getISTTime();
  const todayStr = ist.dateStr;

  // 1. Try Firestore client SDK
  try {
    const docRef = doc(db, 'system_design_daily', todayStr);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as DailySystemDesignRecord;
    }
  } catch (err) {
    console.warn('Firestore direct fetch today failed, falling back to backend API:', err);
  }

  // 2. Fall back to backend API (which auto-picks if missing)
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    const res = await fetch(`${backendUrl}/api/system-design/today?raw=true`, { cache: 'no-store' });
    if (res.ok) {
      return (await res.json()) as DailySystemDesignRecord;
    }
  } catch (err) {
    console.warn('Backend API fetch today failed:', err);
  }

  return null;
}

/**
 * Fetch all assigned system design records:
 * Tries Firestore client SDK first, then backend API.
 */
export async function fetchAllAssignedSystemDesign(): Promise<DailySystemDesignRecord[]> {
  try {
    const colRef = collection(db, 'system_design_daily');
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      const records = snap.docs.map(d => d.data() as DailySystemDesignRecord);
      records.sort((a, b) => a.date.localeCompare(b.date));
      return records;
    }
  } catch (err) {
    console.warn('Firestore fetch all failed, trying backend API:', err);
  }

  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    const res = await fetch(`${backendUrl}/api/system-design/all?raw=true`, { cache: 'no-store' });
    if (res.ok) {
      return (await res.json()) as DailySystemDesignRecord[];
    }
  } catch (err) {
    console.warn('Backend API fetch all failed:', err);
  }

  return [];
}
