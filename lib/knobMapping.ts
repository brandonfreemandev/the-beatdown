// Maps a 0-1 knob slider value to its real audio-engine unit. Shared by ModuleControls (live editing)
// and useTrackPlayback (read-only playback of a submitted arrangement) so the two never drift apart.
export const mapCutoff = (v: number) => 200 + v * v * 17800; // Hz
export const mapDecay  = (v: number) => 0.05 + v * 2.0;      // seconds
export const mapAttack = (v: number) => 0.001 + v * 0.3;     // seconds
export const mapRes    = (v: number) => v * 20;               // Q
export const mapPan    = (v: number) => (v - 0.5) * 2;        // -1..1
