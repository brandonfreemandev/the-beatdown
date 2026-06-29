'use client';
import { useState } from 'react';
import { useStore, MODULE_COLORS } from '@/lib/store';
import type { ModuleType } from '@/lib/audioEngine';

interface Props {
  module: ModuleType;
}

const BTN: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  fontFamily: 'monospace',
  fontWeight: 700,
  fontSize: 9,
  letterSpacing: 1,
  cursor: 'pointer',
  padding: '2px 5px',
  color: '#000',
  flexShrink: 0,
};

export default function VaultPanel({ module }: Props) {
  const vault = useStore((s) => s.vaults[module]);
  const loadPatternToGrid = useStore((s) => s.loadPatternToGrid);
  const saveGridToPattern = useStore((s) => s.saveGridToPattern);
  const addPattern = useStore((s) => s.addPattern);
  const deletePattern = useStore((s) => s.deletePattern);
  const duplicatePattern = useStore((s) => s.duplicatePattern);
  const renamePattern = useStore((s) => s.renamePattern);
  const color = MODULE_COLORS[module];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const startRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditValue(currentName);
  };

  const commitRename = () => {
    if (editingId && editValue.trim()) {
      renamePattern(module, editingId, editValue.trim().toUpperCase());
    }
    setEditingId(null);
  };

  return (
    <div
      style={{
        width: 230,
        borderLeft: '3px solid #000',
        display: 'flex',
        flexDirection: 'column',
        background: '#f9f9f7',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          background: color,
          borderBottom: '3px solid #000',
          padding: '6px 10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ fontWeight: 900, fontSize: 11, letterSpacing: 2, fontFamily: 'monospace' }}>VAULT</span>
        <button
          onClick={() => saveGridToPattern(module)}
          title="Save current grid to active pattern"
          style={{
            background: '#000',
            color: '#f9f9f7',
            border: 'none',
            fontFamily: 'monospace',
            fontWeight: 700,
            fontSize: 9,
            letterSpacing: 1,
            padding: '3px 8px',
            cursor: 'pointer',
          }}
        >
          SAVE
        </button>
      </div>

      {/* Pattern slots */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {vault.patterns.map((p) => {
          const isActive = p.id === vault.activePatternId;
          const isEditing = editingId === p.id;
          return (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                background: isActive ? 'rgba(0,0,0,0.07)' : '#f9f9f7',
                borderBottom: isActive ? '3px solid #000' : '2px solid #000',
                minHeight: 36,
                position: 'relative',
              }}
            >
              {/* Active indicator stripe */}
              {isActive && (
                <div style={{ width: 3, alignSelf: 'stretch', background: color, flexShrink: 0 }} />
              )}
              {!isActive && (
                <div style={{ width: 3, alignSelf: 'stretch', flexShrink: 0 }} />
              )}

              {/* Pattern name — click to load, double-click to rename */}
              <button
                onClick={() => loadPatternToGrid(module, p.id)}
                onDoubleClick={() => startRename(p.id, p.data.patternName)}
                title="Click to load · Double-click to rename"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 8px',
                  background: 'transparent',
                  border: 'none',
                  fontFamily: 'monospace',
                  fontWeight: isActive ? 900 : 700,
                  fontSize: 11,
                  letterSpacing: 1,
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: '#000',
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    width: 7, height: 7,
                    background: isActive ? color : 'transparent',
                    border: `2px solid ${isActive ? color : '#000'}`,
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                {isEditing ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setEditingId(null);
                      e.stopPropagation();
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 900,
                      fontSize: 11,
                      letterSpacing: 1,
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '2px solid #000',
                      outline: 'none',
                      width: '100%',
                      color: '#000',
                      padding: 0,
                    }}
                  />
                ) : (
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.data.patternName}
                  </span>
                )}
              </button>

              {/* Action buttons */}
              <div style={{ display: 'flex', borderLeft: '2px solid #000' }}>
                <button
                  onClick={() => duplicatePattern(module, p.id)}
                  title="Duplicate"
                  disabled={vault.patterns.length >= 5}
                  style={{ ...BTN, opacity: vault.patterns.length >= 5 ? 0.3 : 1 }}
                >
                  ⧉
                </button>
                <button
                  onClick={() => deletePattern(module, p.id)}
                  title="Delete"
                  disabled={vault.patterns.length <= 1}
                  style={{ ...BTN, opacity: vault.patterns.length <= 1 ? 0.3 : 1, borderLeft: '1px solid #00000033' }}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}

        {vault.patterns.length < 5 && (
          <button
            onClick={() => addPattern(module)}
            style={{
              padding: '10px 12px',
              background: 'transparent',
              color: '#666',
              fontFamily: 'monospace',
              fontSize: 11,
              letterSpacing: 1,
              cursor: 'pointer',
              textAlign: 'left',
              border: 'none',
              borderBottom: '2px solid #000',
              width: '100%',
            }}
          >
            + NEW PATTERN
          </button>
        )}

        {Array.from({
          length: Math.max(0, 5 - vault.patterns.length - (vault.patterns.length < 5 ? 1 : 0)),
        }).map((_, i) => (
          <div key={i} style={{ padding: '10px 12px', borderBottom: '2px solid #000', color: '#ccc', fontFamily: 'monospace', fontSize: 11 }}>
            — EMPTY —
          </div>
        ))}
      </div>

      <div style={{ padding: '6px 12px', borderTop: '3px solid #000', fontFamily: 'monospace', fontSize: 9, color: '#666', letterSpacing: 1 }}>
        {vault.patterns.length}/5 PATTERNS · DOUBLE-CLICK TO RENAME
      </div>
    </div>
  );
}
