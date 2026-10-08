/**
 * resetAndReanalyze.ts
 *
 * 1. Wipes the entire `analyses` collection
 * 2. Resets every submission's `analyzed` flag to false and clears the
 *    `analysis` sub-object so that analyzePending.ts will pick them all up
 * 3. Runs the full analysis batch
 */

import { db } from '../firebase/config';
import { agent } from '../langgraph/agent';

async function resetAndReanalyze() {
  // ─── Step 1: wipe analyses collection ──────────────────────────────────────
  console.log('\n🗑️  Wiping analyses collection...');
  const analysesSnap = await db.collection('analyses').get();
  let deleted = 0;
  for (const doc of analysesSnap.docs) {
    await doc.ref.delete();
    deleted++;
  }
  console.log(`   ✅ Deleted ${deleted} analysis documents.`);

  // ─── Step 2: reset every submission ────────────────────────────────────────
  console.log('\n🔄  Resetting all submissions to analyzed=false...');
  const submissionsSnap = await db.collection('submissions').get();
  let resetCount = 0;
  for (const doc of submissionsSnap.docs) {
    await doc.ref.set(
      { analyzed: false, analysis: null, analyzedAt: null },
      { merge: true }
    );
    resetCount++;
  }
  console.log(`   ✅ Reset ${resetCount} submissions.`);

  // ─── Step 3: fetch pending (all should be pending now) ─────────────────────
  console.log('\n🤖  Fetching all submissions for re-analysis...');
  const allSnap = await db.collection('submissions').get();
  const pending = allSnap.docs
    .map(doc => ({ docId: doc.id, ...doc.data() as any }))
    .filter(sub => sub.code); // must have code

  console.log(`   Found ${pending.length} submissions to re-analyze.`);
  if (pending.length === 0) {
    console.log('   ⚠️  No submissions with code found. Run "npm run fetch" first.');
    process.exit(0);
  }

  // ─── Step 4: re-analyze one by one ─────────────────────────────────────────
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < pending.length; i++) {
    const sub = pending[i];
    console.log(`\n⏳ [${i + 1}/${pending.length}] ${sub.title} (@${sub.username})`);

    const initialState = {
      submissionId: sub.submissionId,
      code: sub.code,
      lang: sub.language || 'javascript',
      questionContext: sub.questionContext || 'No description available',
      timeComplexityScore: null,
      spaceComplexityScore: null,
      readabilityScore: null,
      maintainabilityScore: null,
      simplicityScore: null,
      edgeCasesScore: null,
      errorHandlingScore: null,
      approachesUsed: [],
      feedback: '',
      aggregatedScore: null,
    };

    try {
      const finalState = await agent.invoke(initialState);

      // Derive date from the stored `date` field (preferred) or timestamp
      const dateString: string =
        sub.date ||
        new Date(parseInt(sub.timestamp) * 1000).toISOString().split('T')[0];

      // Update submission document
      await db.collection('submissions').doc(sub.docId).set(
        {
          analyzed: true,
          analysis: {
            timeComplexityScore:  finalState.timeComplexityScore,
            spaceComplexityScore: finalState.spaceComplexityScore,
            readabilityScore:     finalState.readabilityScore,
            maintainabilityScore: finalState.maintainabilityScore,
            simplicityScore:      finalState.simplicityScore,
            edgeCasesScore:       finalState.edgeCasesScore,
            errorHandlingScore:   finalState.errorHandlingScore,
            aggregatedScore:      finalState.aggregatedScore,
            approachesUsed:       finalState.approachesUsed,
            feedback:             finalState.feedback,
          },
          analyzedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // Upsert into analyses collection (used by Leaderboard)
      const analysisId = `${sub.username}_${dateString}`;
      await db.collection('analyses').doc(analysisId).set(
        {
          username:         sub.username,
          date:             dateString,
          totalScore:       finalState.aggregatedScore,
          timeScore:        finalState.timeComplexityScore,
          spaceScore:       finalState.spaceComplexityScore,
          readabilityScore: finalState.readabilityScore,
          approach:         (finalState.approachesUsed?.[0] ?? 'Unknown'),
        },
        { merge: true }
      );

      console.log(
        `   ✅ Score: ${finalState.aggregatedScore}/10 | Approaches: ${(finalState.approachesUsed ?? []).join(', ') || 'none'}`
      );
      successCount++;
    } catch (err: any) {
      console.error(`   ❌ Failed: ${err.message}`);
      failCount++;
    }
  }

  console.log(
    `\n🎉 Re-analysis complete! ${successCount} succeeded, ${failCount} failed.`
  );
  process.exit(0);
}

resetAndReanalyze().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
