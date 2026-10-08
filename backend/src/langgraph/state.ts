export interface AgentState {
  submissionId: string;
  code: string;
  lang: string;
  questionContext: string;
  timeComplexityScore: number | null;
  spaceComplexityScore: number | null;
  readabilityScore: number | null;
  maintainabilityScore: number | null;
  simplicityScore: number | null;
  edgeCasesScore: number | null;
  errorHandlingScore: number | null;
  approachesUsed: string[];
  feedback: string;
  aggregatedScore: number | null;
}
