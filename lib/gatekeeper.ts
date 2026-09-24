/**
 * Votes a producer must cast before submitting.
 * Caps at 3 so the early Arena stays unlockable, and never exceeds the number of
 * active battles available to vote on (1 vote per battle).
 */
export function votesRequired(entryCount: number, activeBattleCount?: number): number {
  if (activeBattleCount !== undefined && activeBattleCount <= 0) return 0;
  const fromEntries = entryCount > 0 ? Math.ceil(entryCount / 2) : 1;
  const capped = Math.min(fromEntries, 3);
  if (activeBattleCount === undefined) return capped;
  return Math.min(capped, activeBattleCount);
}
