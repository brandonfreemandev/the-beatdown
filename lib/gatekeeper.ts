/**
 * Gatekeeper switch. false = submit is open to everyone (onboarding mode):
 * `votesRequired()` returns 0, the SUBMIT button unlocks, and the gate UI hides.
 * Set to true to reinstate the vote-to-submit requirement, then redeploy.
 */
export const GATEKEEPER_ENABLED = false;

/**
 * Votes a producer must cast before submitting.
 * Caps at 3 so the early Arena stays unlockable, and never exceeds the number of
 * active battles available to vote on (1 vote per battle).
 */
export function votesRequired(entryCount: number, activeBattleCount?: number): number {
  if (!GATEKEEPER_ENABLED) return 0;
  if (activeBattleCount !== undefined && activeBattleCount <= 0) return 0;
  const fromEntries = entryCount > 0 ? Math.ceil(entryCount / 2) : 1;
  const capped = Math.min(fromEntries, 3);
  if (activeBattleCount === undefined) return capped;
  return Math.min(capped, activeBattleCount);
}
