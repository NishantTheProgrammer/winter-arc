import { db } from '../firebase/config';
import { agent } from '../langgraph/agent';

async function runAnalysisBatch() {
  console.log('🤖 Scanning Firestore for pending analyses...');

  // 1. Get all submissions
  const snapshot = await db.collection('submissions').get();
  
  // 2. Filter for submissions that have code but haven't been analyzed
  const pending = snapshot.docs
    .map(doc => ({ docId: doc.id, ...doc.data() as any }))
    .filter(sub => sub.code && !sub.analyzed);

  console.log(`Found ${pending.length} submissions ready for AI Analysis.`);

  if (pending.length === 0) {
    console.log('✅ Nothing to do. All fetched code is already analyzed!');
    process.exit(0);
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

      // If we want the Leaderboard to pick this up, we should also save a record in 'analyses'
      // The leaderboard reads from 'analyses' filtering by today's date.
      // We will create a document using the submission timestamp date.
      const dateString = new Date(parseInt(sub.timestamp) * 1000).toISOString().split('T')[0];
      const analysisId = `${sub.username}_${dateString}`;
      
      const analysisRef = db.collection('analyses').doc(analysisId);
      await analysisRef.set({
        username: sub.username,
        date: dateString,
        totalScore: finalState.aggregatedScore,
        timeScore: finalState.timeComplexityScore,
        spaceScore: finalState.spaceComplexityScore,
        readabilityScore: finalState.readabilityScore,
        approach: "Automatic Bulk Scan"
      }, { merge: true });

      console.log(`  ✅ Score: ${finalState.aggregatedScore}/10. Saved.`);
      successCount++;
    } catch (error: any) {
      console.error(`  ❌ Failed to analyze: ${error.message}`);
    }
  }

  console.log(`\n🎉 Completed AI Analysis for ${successCount} submissions!`);
  process.exit(0);
}

runAnalysisBatch().catch(console.error);
