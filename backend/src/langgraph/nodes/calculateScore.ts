import { AgentState } from "../state";

export const calculateScoreNode = (state: AgentState): Partial<AgentState> => {
  const tScore = state.timeComplexityScore || 0;
  const sScore = state.spaceComplexityScore || 0;
  const rScore = state.readabilityScore || 0;

  // Weightage: Time 40%, Space 30%, Readability 30%
  const aggregatedScore = (tScore * 0.4) + (sScore * 0.3) + (rScore * 0.3);

  return {
    aggregatedScore: parseFloat(aggregatedScore.toFixed(2)),
  };
};
