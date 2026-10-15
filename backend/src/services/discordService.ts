import { db } from '../firebase/config';
import { getISTDateString, pickProblemsForDate, getAssignedRecordForDate } from './systemDesignService';
import { getCompaniesForProblem, formatCompaniesForAnnouncement } from './companyService';
import { getQuestionOfTheDay, getFullQuestionDetails } from '../leetcode/client';
import { sendDiscordMessage } from './discordClient';

export interface AnnouncementData {
  targetDate: string;
  dayNumber: number;
  isDetected: boolean;
  qotd: {
    title: string;
    titleSlug: string;
    difficulty: string;
    link: string;
    companies: string[];
    companiesFormatted: string;
  };
  systemDesign: {
    titles: string;
    statement: string;
    problemsCount: number;
  };
  plainText: string;
  embed: any;
}

export function calculateDayNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = new Date(2026, 9, 1); // 2026-10-01
  const current = new Date(y, m - 1, d);
  const diffTime = current.getTime() - start.getTime();
  return Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);
}

function getDifficultyColor(difficulty: string): number {
  switch (difficulty.toLowerCase()) {
    case 'easy':
      return 0x2cbb5d; // LeetCode Green
    case 'hard':
      return 0xef4743; // LeetCode Red
    case 'medium':
    default:
      return 0xffc01e; // LeetCode Yellow/Orange
  }
}

/**
 * Fetch data and prepare the announcement payload for a given date.
 */
export async function prepareAnnouncementData(targetDateInput?: string): Promise<AnnouncementData> {
  const targetDate = targetDateInput || getISTDateString();
  const dayNumber = calculateDayNumber(targetDate);

  // 1. Fetch QOTD from Firestore or fallback to LeetCode API
  let qotdData: any = null;
  const qotdDoc = await db.collection('qotd').doc(targetDate).get();
  if (qotdDoc.exists) {
    qotdData = qotdDoc.data();
  }

  if (!qotdData) {
    try {
      const activeQ = await getQuestionOfTheDay();
      if (activeQ && activeQ.date === targetDate && activeQ.question) {
        const full = await getFullQuestionDetails(activeQ.question.titleSlug);
        qotdData = {
          date: activeQ.date,
          title: activeQ.question.title,
          titleSlug: activeQ.question.titleSlug,
          difficulty: activeQ.question.difficulty || 'Medium',
          link: activeQ.link ? `https://leetcode.com${activeQ.link}` : `https://leetcode.com/problems/${activeQ.question.titleSlug}/`,
          content: full?.content || activeQ.question.content || '',
        };
        // Save to Firestore so sync is recorded
        await db.collection('qotd').doc(targetDate).set(qotdData, { merge: true });
      }
    } catch (err: any) {
      console.warn(`[DiscordService] Could not dynamically fetch QOTD: ${err.message}`);
    }
  }

  const isQotdDetected = Boolean(qotdData && qotdData.title);
  const qotdTitle = qotdData?.title || 'Daily LeetCode Problem';
  const qotdSlug = qotdData?.titleSlug || '';
  const qotdDifficulty = qotdData?.difficulty || 'Medium';
  const qotdLink = qotdData?.link || (qotdSlug ? `https://leetcode.com/problems/${qotdSlug}/` : 'https://leetcode.com/problemset/all/');

  const companies = getCompaniesForProblem(qotdLink || qotdSlug);
  const companiesFormatted = formatCompaniesForAnnouncement(companies);
  const companiesSection = companiesFormatted ? `\n${companiesFormatted}` : '';

  // 2. Fetch System Design Record
  let sdRecord = await getAssignedRecordForDate(targetDate);
  if (!sdRecord) {
    try {
      sdRecord = await pickProblemsForDate(targetDate);
    } catch (err: any) {
      console.warn(`[DiscordService] Could not auto-pick System Design problem: ${err.message}`);
    }
  }

  let sdTitles = 'No System Design Challenge scheduled';
  let sdStatement = 'No details available.';
  let sdSection = '';
  let problemsCount = 0;

  if (sdRecord && sdRecord.problems && sdRecord.problems.length > 0) {
    problemsCount = sdRecord.problems.length;
    if (problemsCount === 1) {
      const p = sdRecord.problems[0];
      sdTitles = p.title;
      sdStatement = p.problem_statement;
      sdSection = `\n\nSystem design: ${p.title}\n\n${p.problem_statement}`;
    } else {
      sdTitles = sdRecord.problems.map((p) => p.title).join(' & ');
      const details = sdRecord.problems
        .map((p, idx) => `Problem ${idx + 1} (${p.title}):\n${p.problem_statement}`)
        .join('\n\n');
      sdStatement = details;
      sdSection = `\n\nSystem design: ${sdTitles}\n\n${details}`;
    }
  }

  // 3. Format Plain Text (exact WhatsApp matching format)
  const plainText = `Day ${dayNumber}: ${qotdDifficulty}\n\nLeetcode:\n${qotdLink}${companiesSection}${sdSection}`;

  // 4. Format Discord Embed (Minimalist & Clean)
  let embedSdStatement = sdStatement.trim();
  if (embedSdStatement.length > 1000) {
    embedSdStatement = embedSdStatement.substring(0, 995) + '...';
  }

  const embed = {
    title: `Day ${dayNumber}: ${qotdDifficulty}`,
    color: getDifficultyColor(qotdDifficulty),
    fields: [
      {
        name: 'Leetcode',
        value: `${qotdLink}${companiesSection ? `\n${companiesSection.trim()}` : ''}`,
        inline: false,
      },
      {
        name: `System design: ${sdTitles}`,
        value: embedSdStatement || 'No details available.',
        inline: false,
      },
    ],
  };

  return {
    targetDate,
    dayNumber,
    isDetected: isQotdDetected && problemsCount > 0,
    qotd: {
      title: qotdTitle,
      titleSlug: qotdSlug,
      difficulty: qotdDifficulty,
      link: qotdLink,
      companies,
      companiesFormatted,
    },
    systemDesign: {
      titles: sdTitles,
      statement: sdStatement,
      problemsCount,
    },
    plainText,
    embed,
  };
}

export interface SendAnnouncementOptions {
  force?: boolean;
  dryRun?: boolean;
  targetDate?: string;
  format?: 'embed' | 'plain' | 'both';
}

export interface SendAnnouncementResult {
  success: boolean;
  status: 'POSTED' | 'ALREADY_POSTED' | 'WAITING_FOR_DATA' | 'DRY_RUN' | 'CONFIG_MISSING' | 'ERROR';
  message: string;
  data?: AnnouncementData;
}

/**
 * Check idempotency and post the daily announcement to Discord.
 */
export async function sendDailyAnnouncement(
  options: SendAnnouncementOptions = {}
): Promise<SendAnnouncementResult> {
  const targetDate = options.targetDate || getISTDateString();
  const format = options.format || (process.env.DISCORD_MESSAGE_FORMAT as any) || 'plain';

  console.log(`\n📢 [Discord Bot] Preparing daily announcement for ${targetDate}...`);

  // 1. Idempotency Check
  const announcementRef = db.collection('discord_announcements').doc(targetDate);
  const existingDoc = await announcementRef.get();

  if (existingDoc.exists && !options.force && !options.dryRun) {
    const existing = existingDoc.data();
    const msg = `Daily announcement for ${targetDate} was already posted at ${existing?.postedAt || 'earlier today'}. Skipping. Use --force to re-post.`;
    console.log(`ℹ️  [Discord Bot] ${msg}`);
    return {
      success: true,
      status: 'ALREADY_POSTED',
      message: msg,
    };
  }

  // 2. Build announcement payload
  const announcement = await prepareAnnouncementData(targetDate);

  // 3. Detection Check: ensure both problems are detected before posting
  if (!announcement.isDetected && !options.force && !options.dryRun) {
    const msg = `Today's Question of the Day (${targetDate}) or System Design problem is not yet detected. Waiting for next sync cycle.`;
    console.log(`⏳ [Discord Bot] ${msg}`);
    return {
      success: false,
      status: 'WAITING_FOR_DATA',
      message: msg,
      data: announcement,
    };
  }

  // 4. Dry-run mode
  if (options.dryRun) {
    console.log('\n--- [DRY RUN PREVIEW] ---');
    console.log(`Target Date: ${announcement.targetDate} (Day ${announcement.dayNumber})`);
    console.log(`QOTD: ${announcement.qotd.title} (${announcement.qotd.difficulty})`);
    console.log(`System Design: ${announcement.systemDesign.titles}`);
    console.log('\n[Plain Text Format]:');
    console.log(announcement.plainText);
    console.log('\n[Embed Structure]:');
    console.log(JSON.stringify(announcement.embed, null, 2));
    console.log('-------------------------\n');

    return {
      success: true,
      status: 'DRY_RUN',
      message: 'Dry run completed successfully. No request sent to Discord.',
      data: announcement,
    };
  }

  // 5. Build Discord API request body
  let payload: Record<string, any> = {};

  if (format === 'plain') {
    payload.content = announcement.plainText;
  } else if (format === 'both') {
    payload.content = announcement.plainText;
    payload.embeds = [announcement.embed];
  } else {
    // Pure clean embed (no redundant outer header)
    payload.embeds = [announcement.embed];
  }

  // 6. Send to Discord with automatic retries and backoff
  console.log(`🚀 [Discord Bot] Sending daily challenge announcement to Discord (with retries)...`);
  const sendRes = await sendDiscordMessage({
    content: payload.content,
    embeds: payload.embeds,
    maxRetries: 3,
    initialDelayMs: 2000,
  });

  if (!sendRes.success) {
    console.error(`❌ [Discord Bot] Failed to send announcement to Discord: ${sendRes.error}`);
    return {
      success: false,
      status: 'ERROR',
      message: `Failed to send to Discord: ${sendRes.error}`,
      data: announcement,
    };
  }

  console.log(`✅ [Discord Bot] Daily announcement for Day ${announcement.dayNumber} (${targetDate}) posted successfully!`);

  // 7. Record in Firestore for idempotency (only on verified success)
  await announcementRef.set({
    date: targetDate,
    dayNumber: announcement.dayNumber,
    postedAt: new Date().toISOString(),
    qotdTitle: announcement.qotd.title,
    qotdLink: announcement.qotd.link,
    systemDesignTitle: announcement.systemDesign.titles,
    format,
  });

  return {
    success: true,
    status: 'POSTED',
    message: `Announcement posted successfully to Discord.`,
    data: announcement,
  };
}
