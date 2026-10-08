import { agent } from "../langgraph/agent";
import { db } from "../firebase/config";

export async function processSubmission(submissionId: string, code: string, lang: string, userId: string, questionSlug: string, date: string) {
  console.log(`Starting analysis for submission ${submissionId}...`);
  
  const initialState = {
    submissionId,
    code,
    lang,
    timeComplexityScore: null,
    spaceComplexityScore: null,
    readabilityScore: null,
    approachesUsed: [],
    feedback: "",
    aggregatedScore: null,
  };

  const finalState = await agent.invoke(initialState);
  
  console.log(`Analysis complete for ${submissionId}. Score: ${finalState.aggregatedScore}`);

  // Save to Firebase
  const submissionRef = db.collection('submissions').doc(submissionId);
  await submissionRef.set({
    id: submissionId,
    userId,
    date,
    questionSlug,
    code,
    language: lang,
    analysis: {
      timeComplexityScore: finalState.timeComplexityScore,
      spaceComplexityScore: finalState.spaceComplexityScore,
      readabilityScore: finalState.readabilityScore,
      aggregatedScore: finalState.aggregatedScore,
      approachesUsed: finalState.approachesUsed,
      feedback: finalState.feedback,
    },
    analyzedAt: new Date().toISOString()
  });

  return finalState;
}
