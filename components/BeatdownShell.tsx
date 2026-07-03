'use client';
import { useEffect, useState } from 'react';
import { audioEngine } from '@/lib/audioEngine';
import { usePlayback } from '@/lib/usePlayback';
import { useUndoShortcuts } from '@/lib/useUndoShortcuts';
import { useStore, MODULE_COLORS, MODULE_LABELS, MODULES } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';
import SiteNav from './SiteNav';
import ModuleControls from './ModuleControls';
import ArrangementTimeline from './ArrangementTimeline';
import SubmitModal from './SubmitModal';
import { votesRequired } from '@/lib/gatekeeper';
import type { User } from '@supabase/supabase-js';

export default function BeatdownShell() {
  const activeModule = useStore((s) => s.activeModule);
  const setActiveModule = useStore((s) => s.setActiveModule);

  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [votesCast, setVotesCast] = useState<number | null>(null);
  const [votesRequiredCount, setVotesRequiredCount] = useState(votesRequired(4));
  const [submitOpen, setSubmitOpen] = useState(false);

  const { isPlaying, playhead, toggle, arrIsPlaying, timelineSec, arrLoop, setArrLoop, toggleArr, seekArr, returnToStart } = usePlayback();
  useUndoShortcuts();

  useEffect(() => {
    audioEngine.init();
    const supabase = createClient();
    const loadProfile = async (userId: string) => {
      const { data: profile } = await supabase.from('profiles').select('is_admin, votes_cast').eq('id', userId).maybeSingle() as any;
      setIsAdmin(profile?.is_admin ?? false);
      setVotesCast(profile?.votes_cast ?? 0);
    };
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      if (data.user) await loadProfile(data.user.id);
      const { data: round } = await supabase.from('rounds').select('entry_count').eq('status', 'open').order('started_at', { ascending: false }).limit(1).maybeSingle();
      if (round) setVotesRequiredCount(votesRequired(round.entry_count));
    };
    loadUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
      else { setIsAdmin(false); setVotesCast(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bd-bg)', borderLeft: '3px solid var(--bd-ink)', borderRight: '3px solid var(--bd-ink)', borderBottom: '3px solid var(--bd-ink)', overflow: 'hidden' }}>
      <SiteNav
        currentPage="studio"
        onSubmit={() => setSubmitOpen(true)}
        user={user}
        isAdmin={isAdmin}
        votesCast={votesCast}
        votesRequired={votesRequiredCount}
      />

      {/* Module Tabs */}
      <div style={{ display: 'flex', flexShrink: 0, borderBottom: '3px solid var(--bd-ink)' }}>
        {MODULES.map((m) => {
          const isActive = m === activeModule;
          return (
            <button
              key={m}
              onClick={() => setActiveModule(m)}
              style={{
                flex: 1,
                height: 40,
                background: isActive ? MODULE_COLORS[m] : 'var(--bd-bg)',
                // Module accents are fixed mid-tones — text on them stays literal black in both themes
                color: isActive ? '#000' : 'var(--bd-ink)',
                border: 'none',
                borderRight: m !== 'arp' ? '3px solid var(--bd-ink)' : 'none',
                fontFamily: 'monospace',
                fontWeight: 900,
                fontSize: 11,
                letterSpacing: 3,
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {MODULE_LABELS[m]}
              {isActive && (
                <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'var(--bd-ink)' }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Main area */}
      <div className="main-area">
        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
          <ModuleControls module={activeModule} playhead={playhead} isPlaying={isPlaying} onTogglePlay={toggle} />
        </div>
      </div>

      <ArrangementTimeline
        timelineSec={timelineSec}
        arrIsPlaying={arrIsPlaying}
        arrLoop={arrLoop}
        onToggleArr={toggleArr}
        onToggleLoop={() => setArrLoop(!arrLoop)}
        onSeek={seekArr}
        onReturnToStart={returnToStart}
      />

      {submitOpen && <SubmitModal user={user} onClose={() => setSubmitOpen(false)} />}
    </div>
  );
}
