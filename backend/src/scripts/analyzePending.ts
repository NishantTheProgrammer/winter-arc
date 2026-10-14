import path from 'path';
import { db } from '../firebase/config';
import { agent } from '../langgraph/agent';

export async function runAnalysisBatch(isForce = false): Promise<void> {
  console.log(`🤖 Scanning Firestore for ${isForce ? 'all' : 'pending'} analyses...`);

  // 1. Get all submissions
  const snapshot = await db.collection('submissions').get();
  
  // 1.5 Self-heal: restore analyzed=true if analysis data is already saved in Firestore
  if (!isForce) {
    const alreadyAnalyzedDocs = snapshot.docs
      .map(doc => ({ docId: doc.id, ...doc.data() as any }))
      .filter(sub => sub.analysis && sub.analysis.aggregatedScore !== undefined && sub.analysis.aggregatedScore !== null && !sub.analyzed);

    if (alreadyAnalyzedDocs.length > 0) {
      console.log(`🛠️  Found ${alreadyAnalyzedDocs.length} submissions with completed analysis but analyzed=false. Restoring flags...`);
      const healBatch = db.batch();
      for (const sub of alreadyAnalyzedDocs) {
        const docRef = db.collection('submissions').doc(sub.docId);
        healBatch.set(docRef, { analyzed: true }, { merge: true });

        // Ensure leaderboard document exists in analyses collection
        const dateString = sub.date || new Date(parseInt(sub.timestamp) * 1000).toISOString().split('T')[0];
        const analysisId = `${sub.username}_${dateString}`;
        const analysisRef = db.collection('analyses').doc(analysisId);
        healBatch.set(analysisRef, {
          username: sub.username,
          date: dateString,
          titleSlug: sub.titleSlug,
          totalScore: sub.analysis.aggregatedScore,
          timeScore: sub.analysis.timeComplexityScore ?? null,
          spaceScore: sub.analysis.spaceComplexityScore ?? null,
          readabilityScore: sub.analysis.readabilityScore ?? null,
          approach: (sub.analysis.approachesUsed?.[0] ?? "Automatic Bulk Scan")
        }, { merge: true });
      }
      await healBatch.commit();
      console.log(`✅ Restored analyzed status for ${alreadyAnalyzedDocs.length} submissions without re-running LLM.`);
    }
  }

  // 2. Filter for submissions that actually need analysis
  const pending = snapshot.docs
    .map(doc => ({ docId: doc.id, ...doc.data() as any }))
    .filter(sub => {
      if (!sub.code) return false;
      if (isForce) return true;
      // Normal mode: only analyze if not analyzed AND has no existing analysis
      const hasAnalysis = sub.analysis && sub.analysis.aggregatedScore !== undefined && sub.analysis.aggregatedScore !== null;
      return !sub.analyzed && !hasAnalysis;
    });

  console.log(`Found ${pending.length} submissions ready for AI Analysis.`);

  if (pending.length === 0) {
    console.log('✅ Nothing to do. All fetched code is already analyzed!');
    return;
  }

  // 3. Process one by one (LLM inference is heavy, do sequentially)
  let successCount = 0;
  for (let i = 0; i < pending.length; i++) {
    const sub = pending[i];
    console.log(`\n⏳ Analyzing [${i + 1}/${pending.length}]: ${sub.title} (@${sub.username})`);

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
      feedback: "",
      aggregatedScore: null,
    };

    try {
      const finalState = await agent.invoke(initialState);
      
      const docRef = db.collection('submissions').doc(sub.docId);
      await docRef.set({
        analyzed: true,
        analysis: {
          timeComplexityScore: finalState.timeComplexityScore,
          spaceComplexityScore: finalState.spaceComplexityScore,
          readabilityScore: finalState.readabilityScore,
          maintainabilityScore: finalState.maintainabilityScore,
          simplicityScore: finalState.simplicityScore,
          edgeCasesScore: finalState.edgeCasesScore,
          errorHandlingScore: finalState.errorHandlingScore,
          aggregatedScore: finalState.aggregatedScore,
          approachesUsed: finalState.approachesUsed,
          feedback: finalState.feedback,
        },
        analyzedAt: new Date().toISOString()
      }, { merge: true });

      // Save a record in 'analyses' for the Leaderboard
      const dateString = sub.date || new Date(parseInt(sub.timestamp) * 1000).toISOString().split('T')[0];
      const analysisId = `${sub.username}_${dateString}`;
      
      const analysisRef = db.collection('analyses').doc(analysisId);
      await analysisRef.set({
        username: sub.username,
        date: dateString,
        titleSlug: sub.titleSlug,
        totalScore: finalState.aggregatedScore,
        timeScore: finalState.timeComplexityScore,
        spaceScore: finalState.spaceComplexityScore,
        readabilityScore: finalState.readabilityScore,
        approach: (finalState.approachesUsed?.[0] ?? "Automatic Bulk Scan")
      }, { merge: true });

      console.log(`  ✅ Score: ${finalState.aggregatedScore}/10. Saved.`);
      successCount++;
    } catch (error: any) {
      console.error(`  ❌ Failed to analyze: ${error.message}`);
    }
  }

  console.log(`\n🎉 Completed AI Analysis for ${successCount} submissions!`);
}

// Execute directly if run as a CLI script
if (process.argv[1] && path.basename(process.argv[1]).includes('analyzePending')) {
  const isForce = process.argv.includes('--force');
  runAnalysisBatch(isForce)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Analysis failed:', err);
      process.exit(1);
    });
}
