'use client';
import ProfileButton from './ProfileButton';
import type { User } from '@supabase/supabase-js';
import type { ReactElement } from 'react';

type Page = 'studio' | 'arena' | 'leaderboard';

const VOTES_REQUIRED = 3;

interface Props {
  currentPage: Page;
  user: User | null;
  isAdmin?: boolean;
  votesCast?: number | null;
  /** Studio provides this to open the submit modal directly. Arena/Leaderboard omit it — submit routes to Studio instead. */
  onSubmit?: () => void;
}

const PAGES: { key: Page; label: string; href: string }[] = [
  { key: 'studio', label: 'STUDIO', href: '/' },
  { key: 'arena', label: 'ARENA', href: '/arena' },
  { key: 'leaderboard', label: 'LEADERBOARD', href: '/leaderboard' },
];

function FadersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <g stroke="#000" strokeWidth="2">
        <line x1="5" y1="4" x2="5" y2="20" />
        <line x1="12" y1="4" x2="12" y2="20" />
        <line x1="19" y1="4" x2="19" y2="20" />
      </g>
      <g fill="#000">
        <rect x="2.5" y="7" width="5" height="5" />
        <rect x="9.5" y="13" width="5" height="5" />
        <rect x="16.5" y="9" width="5" height="5" />
      </g>
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <g fill="none" stroke="#000" strokeWidth="2" strokeLinejoin="miter">
        <path d="M7 4 H17 V8 C17 12 14 13 12 13 C10 13 7 12 7 8 Z" />
        <path d="M7 5 C4 5 4 9 7 9" />
        <path d="M17 5 C20 5 20 9 17 9" />
        <line x1="12" y1="13" x2="12" y2="17" />
        <rect x="8" y="17" width="8" height="3" />
      </g>
    </svg>
  );
}

function VsIcon() {
  return <span className="nav-icon-vs" aria-hidden="true">VS</span>;
}

const NAV_ICONS: Record<Page, () => ReactElement> = {
  studio: FadersIcon,
  arena: VsIcon,
  leaderboard: TrophyIcon,
};

export default function SiteNav({ currentPage, user, isAdmin = false, votesCast = null, onSubmit }: Props) {
  const gateBlocked = user !== null && votesCast !== null && votesCast < VOTES_REQUIRED;

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', height: 48, borderTop: '3px solid #000', borderBottom: '3px solid #000', background: '#f9f9f7', flexShrink: 0 }}>

      {/* Logo — always full text, on every viewport */}
      <a href="/" className="nav-logo">THE BEATDOWN</a>

      {/* Nav links — icon on mobile, full word on wide. Same markup/classes on every page. */}
      {PAGES.map(({ key, label, href }) => {
        const isActive = key === currentPage;
        const Icon = NAV_ICONS[key];
        return (
          <a key={key} href={href} className={`nav-link${isActive ? ' active' : ''}`} title={label}>
            <span className="nav-icon"><Icon /></span>
            <span className="nav-label">{label}</span>
            {isActive && <span className="nav-active-underline" />}
          </a>
        );
      })}

      <div style={{ flex: 1 }} />

      {/* Submit lives only in the profile dropdown — no top-bar button on any page. */}
      <ProfileButton
        user={user}
        isAdmin={isAdmin}
        onSubmit={onSubmit ?? (() => { window.location.href = '/'; })}
        gateBlocked={gateBlocked}
        votesCast={votesCast}
        votesRequired={VOTES_REQUIRED}
      />
    </div>
  );
}
