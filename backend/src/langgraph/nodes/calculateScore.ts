import { AgentState } from "../state";

export const calculateScoreNode = (state: AgentState): Partial<AgentState> => {
  const tScore = state.timeComplexityScore || 0;
  const sScore = state.spaceComplexityScore || 0;
  const rScore = state.readabilityScore || 0;
  const mScore = state.maintainabilityScore || 0;
  const simScore = state.simplicityScore || 0;
  const ecScore = state.edgeCasesScore || 0;
  const ehScore = state.errorHandlingScore || 0;

  // Algorithmic Efficiency (70% total weight)
  // Time complexity is the primary differentiator in competitive programming.
  const timeWeight = 45;
  const spaceWeight = 25;
  const algoScore = (tScore * timeWeight) + (sScore * spaceWeight);
  
  // Code Quality (20% total weight)
  const readabilityWeight = 10;
  const simplicityWeight = 5;
  const maintainabilityWeight = 5;
  const qualityScore = (rScore * readabilityWeight) + (simScore * simplicityWeight) + (mScore * maintainabilityWeight);
  
  // Correctness & Robustness (10% total weight)
  const edgeCasesWeight = 7;
  const errorHandlingWeight = 3;
  const robustnessScore = (ecScore * edgeCasesWeight) + (ehScore * errorHandlingWeight);

  // Total max possible weight is 100. 
  // Dividing by 100 normalizes neatly back to a 0-10 scale.
  const weightedSum = algoScore + qualityScore + robustnessScore;
  const aggregatedScore = weightedSum / 100;

  return {
    aggregatedScore: parseFloat(aggregatedScore.toFixed(2)),
  };
};
