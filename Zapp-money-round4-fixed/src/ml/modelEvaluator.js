export function shouldPromoteModel(currentAccuracy = 0, candidateAccuracy = 0, minDelta = 0.001) {
  return Number(candidateAccuracy) > Number(currentAccuracy) + minDelta;
}
