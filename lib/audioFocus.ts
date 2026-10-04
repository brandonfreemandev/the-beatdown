'use client';

// Site-wide single-audio referee: any player that claims focus stops whoever
// held it, so two tunes can never overlap — battle cards, arena, leaderboard,
// studio, all share this one module-level holder per page.
type StopFn = () => void;

let holder: { id: object; stop: StopFn } | null = null;

export function claimAudioFocus(id: object, stop: StopFn) {
  if (holder && holder.id !== id) {
    const prev = holder;
    holder = null; // clear first so prev.stop()'s own release is a no-op
    prev.stop();
  }
  holder = { id, stop };
}

export function releaseAudioFocus(id: object) {
  if (holder?.id === id) holder = null;
}
