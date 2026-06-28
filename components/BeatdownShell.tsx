'use client';
import { useEffect } from 'react';
import { audioEngine } from '@/lib/audioEngine';
import { usePlayback } from '@/lib/usePlayback';
import { useStore, MODULE_COLORS, MODULE_LABELS, MODULES } from '@/lib/store';
import TransportBar from './TransportBar';
import ModuleControls from './ModuleControls';
import VaultPanel from './VaultPanel';
import ArrangementTimeline from './ArrangementTimeline';

export default function BeatdownShell() {
  const activeModule = useStore((s) => s.activeModule);
  const setActiveModule = useStore((s) => s.setActiveModule);
  const toggleVault = useStore((s) => s.toggleVault);
  const vaultOpen = useStore((s) => s.vaults[activeModule].vaultOpen);

  const { isPlaying, playhead, timelineSec, toggle } = usePlayback();

  useEffect(() => {
    audioEngine.init();
  }, []);

  const color = MODULE_COLORS[activeModule];

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
      {/* Transport */}
      <TransportBar isPlaying={isPlaying} onTogglePlay={toggle} />

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
                <span
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: '#000',
                  }}
                />
              )}
            </button>
          );
        })}
        {/* Vault toggle */}
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
          VAULT
        </button>
      </div>

      {/* Main area: controls + optional vault */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
          <ModuleControls module={activeModule} playhead={playhead} />
        </div>
        {vaultOpen && <VaultPanel module={activeModule} />}
      </div>

      {/* Arrangement Timeline */}
      <ArrangementTimeline timelineSec={timelineSec} />
    </div>
  );
}
