import { db } from '../firebase/config';
import { getDailyCodingChallenges, getFullQuestionDetails, getQuestionOfTheDay } from '../leetcode/client';

export async function syncQOTD(isForce = false): Promise<number> {
  console.log(`\n📅 Starting QOTD Sync ${isForce ? '(--force: refreshing all)' : '(incremental)'}...`);
  const months = [10, 11, 12];
  let updatedCount = 0;

  // 1. First ensure today's active QOTD is fetched if available
  try {
    const todayQ = await getQuestionOfTheDay();
    if (todayQ && todayQ.date && todayQ.question) {
      const q = todayQ.question;
      const docRef = db.collection('qotd').doc(todayQ.date);
      const existing = await docRef.get();
      const existingData = existing.exists ? existing.data() : null;

      if (isForce || !existingData || !existingData.content) {
        let content = q.content;
        if (!content) {
          const full = await getFullQuestionDetails(q.titleSlug);
          content = full?.content || null;
        }

        await docRef.set({
          date: todayQ.date,
          title: q.title,
          titleSlug: q.titleSlug,
          difficulty: q.difficulty,
          acRate: typeof q.acRate === 'number' ? q.acRate : (typeof full?.acRate === 'number' ? full.acRate : null),
          questionFrontendId: q.questionFrontendId || null,
          topicTags: q.topicTags?.map((t: any) => ({ name: t.name, slug: t.slug })) || [],
          link: todayQ.link ? `https://leetcode.com${todayQ.link}` : `https://leetcode.com/problems/${q.titleSlug}/`,
          content: content || 'No description available',
          updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log(`  ⭐ Synced today's active QOTD: ${todayQ.date} - ${q.title}`);
        updatedCount++;
      }
    }
  } catch (err: any) {
    console.error(`  ⚠️ Could not fetch active QOTD directly: ${err.message}`);
  }

  // 2. Fetch all challenges for Winter Arc months (Oct-Dec 2026)
  for (const month of months) {
    console.log(`  Fetching daily challenge list for 2026-${month}...`);
    const challenges = await getDailyCodingChallenges(2026, month);
    if (!challenges || challenges.length === 0) continue;

    console.log(`  Found ${challenges.length} challenges for 2026-${month}. Checking content...`);

    for (const challenge of challenges) {
      if (!challenge || !challenge.date || !challenge.question) continue;
      const q = challenge.question;
      const docRef = db.collection('qotd').doc(challenge.date);
      const existing = await docRef.get();
      const existingData = existing.exists ? existing.data() : null;

      // Skip if already has content and acRate, and not forcing
      if (!isForce && existingData && existingData.content && existingData.content !== 'No description available' && existingData.acRate !== undefined) {
        continue;
      }

      // Fetch problem statement / details
      console.log(`  📥 Fetching details for ${challenge.date}: ${q.titleSlug}...`);
      const details = await getFullQuestionDetails(q.titleSlug);
      const acRate = typeof details?.acRate === 'number' ? details.acRate : (typeof q.acRate === 'number' ? q.acRate : null);

      await docRef.set({
        date: challenge.date,
        title: q.title,
        titleSlug: q.titleSlug,
        difficulty: details?.difficulty || q.difficulty || 'Unknown',
        acRate,
        questionFrontendId: details?.questionFrontendId || q.questionFrontendId || null,
        topicTags: details?.topicTags || q.topicTags?.map((t: any) => ({ name: t.name, slug: t.slug })) || [],
        link: challenge.link ? `https://leetcode.com${challenge.link}` : `https://leetcode.com/problems/${q.titleSlug}/`,
        content: details?.content || 'No description available',
        updatedAt: new Date().toISOString()
      }, { merge: true });

      updatedCount++;
    }
  }

  console.log(`✅ QOTD Sync complete. Updated ${updatedCount} records.`);
  return updatedCount;
}

// Allow direct CLI execution
if (process.argv[1]?.endsWith('seedQOTD.ts')) {
  const isForce = process.argv.includes('--force');
  syncQOTD(isForce)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ QOTD Sync failed:', err);
      process.exit(1);
    });
}
