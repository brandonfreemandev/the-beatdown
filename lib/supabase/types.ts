export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          avatar_url: string | null;
          elo_rating: number;
          votes_cast: number;
          submissions_count: number;
          is_admin: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          avatar_url?: string | null;
          elo_rating?: number;
          votes_cast?: number;
          submissions_count?: number;
          is_admin?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string | null;
          avatar_url?: string | null;
          elo_rating?: number;
          votes_cast?: number;
          submissions_count?: number;
          is_admin?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      rounds: {
        Row: {
          id: string;
          status: 'open' | 'matching' | 'closed';
          entry_count: number;
          started_at: string;
          closed_at: string | null;
        };
        Insert: {
          id?: string;
          status?: 'open' | 'matching' | 'closed';
          entry_count?: number;
          started_at?: string;
          closed_at?: string | null;
        };
        Update: {
          id?: string;
          status?: 'open' | 'matching' | 'closed';
          entry_count?: number;
          started_at?: string;
          closed_at?: string | null;
        };
        Relationships: [];
      };
      submissions: {
        Row: {
          id: string;
          user_id: string;
          round_id: string;
          title: string;
          arrangement: Json;
          created_at: string;
        };
        Insert: {
          user_id: string;
          round_id: string;
          title: string;
          arrangement: Json;
          id?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          round_id?: string;
          title?: string;
          arrangement?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          round_id: string;
          track_a_id: string;
          track_b_id: string;
          winner_id: string | null;
          votes_a: number;
          votes_b: number;
          status: 'active' | 'resolved';
          created_at: string;
        };
        Insert: {
          round_id: string;
          track_a_id: string;
          track_b_id: string;
          id?: string;
          winner_id?: string | null;
          votes_a?: number;
          votes_b?: number;
          status?: 'active' | 'resolved';
          created_at?: string;
        };
        Update: {
          id?: string;
          round_id?: string;
          track_a_id?: string;
          track_b_id?: string;
          winner_id?: string | null;
          votes_a?: number;
          votes_b?: number;
          status?: 'active' | 'resolved';
          created_at?: string;
        };
        Relationships: [];
      };
      votes: {
        Row: {
          id: string;
          user_id: string;
          match_id: string;
          voted_for_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          match_id: string;
          voted_for_id: string;
          id?: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Round = Database['public']['Tables']['rounds']['Row'];
export type Submission = Database['public']['Tables']['submissions']['Row'];
export type Match = Database['public']['Tables']['matches']['Row'];
export type Vote = Database['public']['Tables']['votes']['Row'];

// Type-only import — erased at compile time, so this doesn't pull the live Zustand store
// (or its localStorage-touching persist middleware) into server-side code that reads this type.
import type { ModuleVault, ModuleSettings, TimelineBlock } from '../store';

export interface ArrangementData {
  bpm: number;
  grids: Record<string, boolean[][]>;
  // Optional: real submissions made before this field existed lack it. Playback code must
  // fall back to looping `grids` flat for those rather than assume this is always present.
  vaults?: Record<string, ModuleVault>;
  timeline: TimelineBlock[];
  moduleSettings?: Record<string, ModuleSettings>;
}
