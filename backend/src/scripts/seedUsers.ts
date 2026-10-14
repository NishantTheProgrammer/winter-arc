/**
 * Seed script: registers users in Firestore and loads their recent
 * accepted submission history from LeetCode.
 *
 * Incremental by default: will NOT overwrite or reset existing loaded or analyzed data.
 * Pass --force to overwrite/reset existing submissions.
 *
 * Run from project root:
 *   cd backend && npx tsx src/scripts/seedUsers.ts [--force]
 */
import path from 'path';
import { db } from '../firebase/config';
import { getRecentSubmissions, getUserProfile } from '../leetcode/client';

export const USERS = [
  { username: 'nishanttheprogrammer', displayName: 'Nishant', themeColor: '#818cf8' },
  { username: 'mohittheprogrammer', displayName: 'Mohit', themeColor: '#f59e0b' },
  { username: 'surajsingh542', displayName: 'Suraj', themeColor: '#10b981' },
  { username: 'harshit_sodhani', displayName: 'Harshit', themeColor: '#c084fc' },
];

export const SUBMISSION_LIMIT = 50; // how many past accepted submissions to load per user

export async function seedUsers(isForce = false): Promise<void> {
  console.log(`🌱 Starting seed ${isForce ? '(--force enabled: will overwrite/reset)' : '(incremental mode: preserves existing loaded/analyzed data)'}...\n`);

  for (const user of USERS) {
    console.log(`👤 Processing user: ${user.username}`);

    // ── 1. Upsert user document ────────────────────────────────────────────
    const userRef = db.collection('users').doc(user.username);
    await userRef.set(
      {
        username: user.username,
        displayName: user.displayName,
        themeColor: user.themeColor,
        createdAt: new Date().toISOString(),
      },
      { merge: true } // don't overwrite fields we don't set here
    );
    console.log(`  ✅ User document saved`);

    // ── 1.5 Fetch and save avatar to participants collection ───────────────
    const avatar = await getUserProfile(user.username);
    if (avatar) {
      const partRef = db.collection('participants').doc(user.username);
      await partRef.set(
        {
          username: user.username,
          displayName: user.displayName,
          avatar: avatar,
          themeColor: user.themeColor,
        },
        { merge: true }
      );
      console.log(`  🖼️  Avatar saved to participants collection`);
    } else {
      console.log(`  ⚠️  No avatar found for ${user.username}`);
    }

    // ── 2. Fetch recent accepted submissions from LeetCode ─────────────────
    const submissions = await getRecentSubmissions(user.username, SUBMISSION_LIMIT);
    console.log(`  📦 Fetched ${submissions.length} submissions from LeetCode`);

    if (submissions.length === 0) {
      console.log(`  ⚠️  No submissions found (private profile or no activity)\n`);
      continue;
    }

    // ── 2.5 Query existing submissions in Firestore for this user ──────────
    const existingSnap = await db
      .collection('submissions')
      .where('username', '==', user.username)
      .get();
    const existingDocs = new Map(existingSnap.docs.map((doc) => [doc.id, doc.data()]));

    // ── 3. Batch-write submissions to Firestore ───────────────────────────
    // Path: submissions/{username}_{submissionId}
    const batch = db.batch();
    let newCount = 0;
    let skippedCount = 0;
    let repairedCount = 0;

    for (const sub of submissions) {
      const date = new Date(parseInt(sub.timestamp, 10) * 1000)
        .toISOString()
        .split('T')[0]; // YYYY-MM-DD

      const docId = `${user.username}_${sub.id}`;
      const docRef = db.collection('submissions').doc(docId);
      const existing = existingDocs.get(docId);

      if (existing && !isForce) {
        // Submission already exists in Firestore!
        // Do NOT overwrite analyzed: false or delete existing code/analysis
        if (!existing.analyzed && existing.analysis && existing.analysis.aggregatedScore) {
          // Repair: was previously analyzed, keep analyzed: true
          batch.set(docRef, { analyzed: true }, { merge: true });
          repairedCount++;
        } else {
          skippedCount++;
        }
        continue;
      }

      // New submission or force mode:
      const payload: Record<string, any> = {
        submissionId: sub.id,
        username: user.username,
        title: sub.title,
        titleSlug: sub.titleSlug,
        date,
        timestamp: sub.timestamp,
        analyzed: false,
      };

      if (isForce) {
        payload.analysis = null;
        payload.analyzedAt = null;
      }

      batch.set(docRef, payload, { merge: !isForce });
      newCount++;
    }

    await batch.commit();
    console.log(`  💾 Saved ${newCount} new submissions (skipped ${skippedCount} existing, repaired ${repairedCount} flags)\n`);
  }

  console.log('✅ Seed complete!');
}

// Execute directly if run as a CLI script
if (process.argv[1] && path.basename(process.argv[1]).includes('seedUsers')) {
  const isForce = process.argv.includes('--force');
  seedUsers(isForce)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seed failed:', err);
      process.exit(1);
    });
}
