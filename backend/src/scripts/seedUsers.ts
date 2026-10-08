/**
 * Seed script: registers users in Firestore and loads their recent
 * accepted submission history from LeetCode.
 *
 * Run from project root:
 *   cd backend && npx tsx src/scripts/seedUsers.ts
 */
import { db } from '../firebase/config';
import { getRecentSubmissions } from '../leetcode/client';

const USERS = [
  { username: 'nishanttheprogrammer', displayName: 'Nishant' },
  { username: 'mohittheprogrammer',   displayName: 'Mohit'   },
  { username: 'surajsingh542',        displayName: 'Suraj'   },
];

const SUBMISSION_LIMIT = 50; // how many past accepted submissions to load per user

async function seedUsers() {
  console.log('🌱 Starting seed...\n');

  for (const user of USERS) {
    console.log(`👤 Processing user: ${user.username}`);

    // ── 1. Upsert user document ────────────────────────────────────────────
    const userRef = db.collection('users').doc(user.username);
    await userRef.set(
      {
        username:    user.username,
        displayName: user.displayName,
        createdAt:   new Date().toISOString(),
      },
      { merge: true }   // don't overwrite fields we don't set here
    );
    console.log(`  ✅ User document saved`);

    // ── 2. Fetch recent accepted submissions from LeetCode ─────────────────
    const submissions = await getRecentSubmissions(user.username, SUBMISSION_LIMIT);
    console.log(`  📦 Fetched ${submissions.length} submissions from LeetCode`);

    if (submissions.length === 0) {
      console.log(`  ⚠️  No submissions found (private profile or no activity)\n`);
      continue;
    }

    // ── 3. Batch-write submissions to Firestore ───────────────────────────
    //   Path: submissions/{username}_{submissionId}
    const batch = db.batch();
    let count = 0;

    for (const sub of submissions) {
      const date = new Date(parseInt(sub.timestamp, 10) * 1000)
        .toISOString()
        .split('T')[0]; // YYYY-MM-DD

      const docRef = db
        .collection('submissions')
        .doc(`${user.username}_${sub.id}`);

      batch.set(
        docRef,
        {
          submissionId: sub.id,
          username:     user.username,
          title:        sub.title,
          titleSlug:    sub.titleSlug,
          date,
          timestamp:    sub.timestamp,
          analyzed:     false, // will be updated when AI analysis runs
        },
        { merge: true }
      );

      count++;
    }

    await batch.commit();
    console.log(`  💾 Saved ${count} submissions to Firestore\n`);
  }

  console.log('✅ Seed complete!');
  process.exit(0);
}

seedUsers().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
