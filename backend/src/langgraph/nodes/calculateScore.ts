import { AgentState } from "../state";

export const calculateScoreNode = (state: AgentState): Partial<AgentState> => {
  const tScore = state.timeComplexityScore || 0;
  const sScore = state.spaceComplexityScore || 0;
  const rScore = state.readabilityScore || 0;
  const mScore = state.maintainabilityScore || 0;
  const simScore = state.simplicityScore || 0;
  const ecScore = state.edgeCasesScore || 0;
  const ehScore = state.errorHandlingScore || 0;

  // Algorithmic Efficiency (40)
  const algoScore = (tScore * 25) + (sScore * 15);
  
  // Code Quality (20)
  const qualityScore = (rScore * 10) + (mScore * 5) + (simScore * 5);
  
  // Correctness & Robustness (15)
  const robustnessScore = (ecScore * 10) + (ehScore * 5);

  // Total max possible weight is 75. 
  // We divide by 75 to normalize back to a 0-10 scale.
  const weightedSum = algoScore + qualityScore + robustnessScore;
  const aggregatedScore = weightedSum / 75;

  return {
    aggregatedScore: parseFloat(aggregatedScore.toFixed(2)),
  };
};
