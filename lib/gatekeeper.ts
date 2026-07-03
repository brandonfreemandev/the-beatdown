/** Votes a producer must cast before submitting — mirrors `app/api/submit/route.ts`. */
export function votesRequired(entryCount: number): number {
  return entryCount > 0 ? Math.ceil(entryCount / 2) : 1;
}
