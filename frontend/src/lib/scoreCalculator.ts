/**
 * scoreCalculator.ts
 *
 * Dynamically computes the aggregated score (0-10) at runtime from
 * the raw component scores saved in Firestore:
 * - Algorithmic Efficiency (70%): Time 45%, Space 25%
 * - Code Quality (20%): Readability 10%, Simplicity 5%, Maintainability 5%
 * - Correctness & Robustness (10%): Edge Cases 7%, Error Handling 3%
 */

export function calculateAggregatedScore(analysis: any): number {
  if (!analysis) return 0;

  const tScore = typeof analysis.timeComplexityScore === 'number' ? analysis.timeComplexityScore : 0;
  const sScore = typeof analysis.spaceComplexityScore === 'number' ? analysis.spaceComplexityScore : 0;
  const rScore = typeof analysis.readabilityScore === 'number' ? analysis.readabilityScore : 0;
  const mScore = typeof analysis.maintainabilityScore === 'number' ? analysis.maintainabilityScore : 0;
  const simScore = typeof analysis.simplicityScore === 'number' ? analysis.simplicityScore : 0;
  const ecScore = typeof analysis.edgeCasesScore === 'number' ? analysis.edgeCasesScore : 0;
  const ehScore = typeof analysis.errorHandlingScore === 'number' ? analysis.errorHandlingScore : 0;

  // Algorithmic Efficiency (70% total weight)
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

  // Fallback: If raw sub-scores are not present on legacy records, use precomputed aggregatedScore
  if (tScore === 0 && sScore === 0 && rScore === 0 && typeof analysis.aggregatedScore === 'number') {
    return analysis.aggregatedScore;
  }

  const weightedSum = algoScore + qualityScore + robustnessScore;
  return parseFloat((weightedSum / 100).toFixed(1));
}
