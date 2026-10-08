import { agent } from "../langgraph/agent";
import { db } from "../firebase/config";

import { getQuestionData } from "../leetcode/client";

export async function processSubmission(submissionId: string, code: string, lang: string, userId: string, questionSlug: string, date: string) {
  console.log(`Starting analysis for submission ${submissionId}...`);
  
  const questionContext = await getQuestionData(questionSlug) || "No description available";

  const initialState = {
    submissionId,
    code,
    lang,
    questionContext,
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

  const finalState = await agent.invoke(initialState);
  
  console.log(`Analysis complete for ${submissionId}. Score: ${finalState.aggregatedScore}`);

  // Save to Firebase
  const submissionRef = db.collection('submissions').doc(submissionId);
  await submissionRef.set({
    id: submissionId,
    userId,
    date,
    questionSlug,
    questionContext,
    code,
    language: lang,
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
  });

  return finalState;
}
