export function monsterVisible(ndcX, ndcY, ndcZ) {
  if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY) || !Number.isFinite(ndcZ)) return false
  if (ndcZ < -1 || ndcZ > 1) return false
  return Math.abs(ndcX) <= 1.02 && Math.abs(ndcY) <= 1.02
}
