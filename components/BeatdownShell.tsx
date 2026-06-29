'use client';
import { useEffect, useState } from 'react';
import { audioEngine } from '@/lib/audioEngine';
import { usePlayback } from '@/lib/usePlayback';
import { useUndoShortcuts } from '@/lib/useUndoShortcuts';
import { useStore, MODULE_COLORS, MODULE_LABELS, MODULES } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';
import TransportBar from './TransportBar';
import ModuleControls from './ModuleControls';
import VaultPanel from './VaultPanel';
import ArrangementTimeline from './ArrangementTimeline';
import SubmitModal from './SubmitModal';
import type { User } from '@supabase/supabase-js';

export default function BeatdownShell() {
  const activeModule = useStore((s) => s.activeModule);
  const setActiveModule = useStore((s) => s.setActiveModule);
  const toggleVault = useStore((s) => s.toggleVault);
  const vaultOpen = useStore((s) => s.vaults[activeModule].vaultOpen);
  const [user, setUser] = useState<User | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);

  const { isPlaying, playhead, toggle, arrIsPlaying, timelineSec, arrLoop, setArrLoop, toggleArr, seekArr, returnToStart } = usePlayback();
  useUndoShortcuts();

  useEffect(() => {
    audioEngine.init();
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#f9f9f7',
        border: '3px solid #000',
        overflow: 'hidden',
      }}
    >
      <TransportBar
        onSubmit={() => setSubmitOpen(true)}
        user={user}
      />

      {/* Module Tabs */}
      <div style={{ display: 'flex', flexShrink: 0, borderBottom: '3px solid #000' }}>
        {MODULES.map((m) => {
          const isActive = m === activeModule;
          return (
            <button
              key={m}
              onClick={() => setActiveModule(m)}
              style={{
                flex: 1,
                height: 40,
                background: isActive ? MODULE_COLORS[m] : '#f9f9f7',
                color: '#000',
                border: 'none',
                borderRight: m !== 'arp' ? '3px solid #000' : 'none',
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
                <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: '#000' }} />
              )}
            </button>
          );
        })}
        <button
          onClick={() => toggleVault(activeModule)}
          style={{
            width: 80,
            height: 40,
            background: vaultOpen ? '#000' : '#f9f9f7',
            color: vaultOpen ? '#f9f9f7' : '#000',
            border: 'none',
            borderLeft: '3px solid #000',
            fontFamily: 'monospace',
            fontWeight: 700,
            fontSize: 10,
            letterSpacing: 2,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          VAULT {vaultOpen ? '▸' : '◀'}
        </button>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
          <ModuleControls module={activeModule} playhead={playhead} isPlaying={isPlaying} onTogglePlay={toggle} />
        </div>
        {vaultOpen && <VaultPanel module={activeModule} />}
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
