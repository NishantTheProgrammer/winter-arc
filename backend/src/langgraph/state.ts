export interface AgentState {
  submissionId: string;
  code: string;
  lang: string;
  timeComplexityScore: number | null;
  spaceComplexityScore: number | null;
  readabilityScore: number | null;
  approachesUsed: string[];
  feedback: string;
  aggregatedScore: number | null;
}
