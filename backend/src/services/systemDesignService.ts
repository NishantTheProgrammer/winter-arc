import fs from 'fs';
import path from 'path';
import { db } from '../firebase/config';

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
  isBackfill?: boolean;
  backfillForDate?: string;
  backfillDayNumber?: number;
}

export const ARC_START_DATE = '2026-10-01';
export const FEATURE_KICKOFF_DATE = '2026-10-13';

// Dates missed before the System Design feature started (will be caught up on Sundays only)
export const MISSED_DATES = [
  '2026-10-01',
  '2026-10-02',
  '2026-10-03',
  '2026-10-04',
  '2026-10-05',
  '2026-10-06',
  '2026-10-07',
  '2026-10-08',
  '2026-10-09',
  '2026-10-10',
  '2026-10-11',
  '2026-10-12',
];

export interface SystemDesignCatalog {
  name: string;
  total_problems: number;
  difficulty_scale: Record<string, string>;
  problems: SystemDesignProblem[];
}

export interface DailySystemDesignRecord {
  date: string; // YYYY-MM-DD (IST)
  dayOfWeek: number; // 0 for Sunday
  dayName: string;
  isSunday: boolean;
  problemIds: number[];
  problems: SystemDesignProblem[];
  selectedAt: string;
}

export interface ClientDailySystemDesignRecord {
  date: string;
  dayOfWeek: number;
  dayName: string;
  isSunday: boolean;
  problemIds: number[];
  problems: (Omit<SystemDesignProblem, 'tags' | 'resources'> & {
    tags?: string[];
    resources?: SystemDesignResource[];
  })[];
  selectedAt: string;
  isLocked: boolean;
  unlocksAt: string;
}

// ── Load Catalog ─────────────────────────────────────────────────────────────
let cachedCatalog: SystemDesignCatalog | null = null;

export function loadCatalog(): SystemDesignCatalog {
  if (cachedCatalog) return cachedCatalog;

  const candidatePaths = [
    path.join(__dirname, '../data/system-design.json'),
    path.join(process.cwd(), 'src/data/system-design.json'),
    path.join(process.cwd(), 'system-design.json'),
    path.join(process.cwd(), '../system-design.json'),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf-8');
        cachedCatalog = JSON.parse(raw) as SystemDesignCatalog;
        return cachedCatalog;
      } catch (err) {
        console.error(`Failed parsing catalog at ${p}:`, err);
      }
    }
  }

  throw new Error('system-design.json could not be found or loaded.');
}

// ── IST Time Helpers ──────────────────────────────────────────────────────────

/**
 * Returns the current date in YYYY-MM-DD for Indian Standard Time (Asia/Kolkata).
 */
export function getISTDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Returns current IST time components (dateStr, hour, minute, second, isAfter6PM).
 */
export function getISTDetails(date: Date = new Date()) {
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
  const parts = formatter.formatToParts(date);
  const getPart = (t: string) => parts.find(p => p.type === t)?.value || '00';
  const dateStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  const hour = parseInt(getPart('hour'), 10);
  const minute = parseInt(getPart('minute'), 10);
  const second = parseInt(getPart('second'), 10);

  return {
    dateStr,
    hour,
    minute,
    second,
    isAfter6PM: hour >= 18,
  };
}

/**
 * Checks whether tags and resources should be unlocked for the given problem date.
 * - Past dates: ALWAYS unlocked (6 PM IST has passed).
 * - Today: Unlocked ONLY if current IST hour >= 18 (6:00 PM IST or later).
 * - Future dates: Locked.
 */
export function isResourcesUnlockedIST(problemDate: string, now: Date = new Date()): boolean {
  const ist = getISTDetails(now);
  if (problemDate < ist.dateStr) return true;
  if (problemDate === ist.dateStr) return ist.isAfter6PM;
  return false;
}

// ── Problem Picking Logic ────────────────────────────────────────────────────

/**
 * Retrieve all assigned daily system design records from Firestore.
 */
export async function getAllAssignedRecords(): Promise<DailySystemDesignRecord[]> {
  const snap = await db.collection('system_design_daily').orderBy('date', 'asc').get();
  return snap.docs.map(doc => doc.data() as DailySystemDesignRecord);
}

/**
 * Retrieve the daily system design record for a specific date from Firestore.
 */
export async function getAssignedRecordForDate(dateStr: string): Promise<DailySystemDesignRecord | null> {
  const doc = await db.collection('system_design_daily').doc(dateStr).get();
  if (!doc.exists) return null;
  return doc.data() as DailySystemDesignRecord;
}

/**
 * Core selection function:
 * Pick 1 question (or 2 questions if Sunday) for target date following difficulty order 0 -> 5.
 * Checks Firestore so previously selected problems are not re-picked.
 * Idempotent: if targetDate already exists, returns existing record.
 */
export async function pickProblemsForDate(targetDate: string): Promise<DailySystemDesignRecord> {
  // 1. Return existing if already picked
  const existing = await getAssignedRecordForDate(targetDate);
  if (existing) {
    return existing;
  }

  const catalog = loadCatalog();
  const allProblems = catalog.problems;

  // 2. Fetch all previously assigned problem IDs
  const allRecords = await getAllAssignedRecords();
  const assignedIds = new Set<number>();
  for (const rec of allRecords) {
    if (rec.problemIds && Array.isArray(rec.problemIds)) {
      rec.problemIds.forEach(id => assignedIds.add(id));
    } else if (rec.problems && Array.isArray(rec.problems)) {
      rec.problems.forEach(p => assignedIds.add(p.id));
    }
  }

  // 3. Determine number of questions needed (Sunday = 2 questions, Mon-Sat = 1 question)
  // Use noon IST for targetDate to accurately get dayOfWeek without UTC offset issues
  const dateObj = new Date(`${targetDate}T12:00:00+05:30`);
  const dayOfWeek = dateObj.getDay();
  const isSunday = dayOfWeek === 0;
  const questionsNeeded = isSunday ? 2 : 1;

  const chosenProblems: SystemDesignProblem[] = [];

  for (let q = 0; q < questionsNeeded; q++) {
    // Find the lowest difficulty level (0 to 5) that still has unpicked problems
    let chosenDifficulty = -1;
    for (let diff = 0; diff <= 5; diff++) {
      const availableAtDiff = allProblems.filter(
        p => p.difficulty === diff && !assignedIds.has(p.id)
      );
      if (availableAtDiff.length > 0) {
        chosenDifficulty = diff;
        break;
      }
    }

    let candidates: SystemDesignProblem[] = [];
    if (chosenDifficulty !== -1) {
      candidates = allProblems.filter(
        p => p.difficulty === chosenDifficulty && !assignedIds.has(p.id)
      );
    } else {
      // Fallback if all difficulties 0-5 are exhausted: any remaining unpicked problem
      candidates = allProblems.filter(p => !assignedIds.has(p.id));
    }

    if (candidates.length === 0) {
      console.warn(`All 92 problems have been assigned! Resetting pool for overflow.`);
      // If all 92 have been assigned, allow picking from all problems
      candidates = allProblems;
    }

    // Pick random problem from available candidates
    const randomIndex = Math.floor(Math.random() * candidates.length);
    const picked: SystemDesignProblem = { ...candidates[randomIndex] };

    // If it is a Sunday and this is the second question (q === 1):
    // This is the additional catch-up problem! Mark which missed date it backfills.
    if (isSunday && q === 1) {
      const alreadyBackfilled = new Set<string>();
      for (const r of allRecords) {
        for (const p of r.problems) {
          if (p.isBackfill && p.backfillForDate) {
            alreadyBackfilled.add(p.backfillForDate);
          }
        }
      }
      const nextDateToBackfill = MISSED_DATES.find(d => !alreadyBackfilled.has(d));
      if (nextDateToBackfill) {
        picked.isBackfill = true;
        picked.backfillForDate = nextDateToBackfill;
        const dayNumber = parseInt(nextDateToBackfill.split('-')[2], 10);
        picked.backfillDayNumber = dayNumber;
      }
    }

    assignedIds.add(picked.id);
    chosenProblems.push(picked);
  }

  const dayName = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'Asia/Kolkata',
  });

  const record: DailySystemDesignRecord = {
    date: targetDate,
    dayOfWeek,
    dayName,
    isSunday,
    problemIds: chosenProblems.map(p => p.id),
    problems: chosenProblems,
    selectedAt: new Date().toISOString(),
  };

  // 4. Save to Firestore
  await db.collection('system_design_daily').doc(targetDate).set(record);
  console.log(`✅ Assigned ${chosenProblems.length} problem(s) for ${targetDate} (${dayName}):`,
    chosenProblems.map(p => `[ID ${p.id}: ${p.title} (Diff ${p.difficulty})]`).join(', ')
  );

  return record;
}

/**
 * Get today's system design problem in IST, picking it if it doesn't exist yet.
 */
export async function getOrPickToday(): Promise<DailySystemDesignRecord> {
  const todayIST = getISTDateString();
  return pickProblemsForDate(todayIST);
}

/**
 * Format a record for client consumption with 6:00 PM IST locking logic applied.
 */
export function sanitizeRecordForClient(
  record: DailySystemDesignRecord,
  forceUnlock = false
): ClientDailySystemDesignRecord {
  const unlocked = forceUnlock || isResourcesUnlockedIST(record.date);

  const sanitizedProblems = record.problems.map(problem => {
    if (unlocked) {
      return problem;
    }
    // Before 6 PM IST: hide tags and resources
    const { tags, resources, ...rest } = problem;
    return {
      ...rest,
      tags: [],
      resources: [],
    };
  });

  return {
    date: record.date,
    dayOfWeek: record.dayOfWeek,
    dayName: record.dayName,
    isSunday: record.isSunday,
    problemIds: record.problemIds,
    problems: sanitizedProblems,
    selectedAt: record.selectedAt,
    isLocked: !unlocked,
    unlocksAt: '18:00:00 IST (6:00 PM)',
  };
}
