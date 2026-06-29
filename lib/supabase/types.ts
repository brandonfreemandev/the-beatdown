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
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
      };
      rounds: {
        Row: {
          id: string;
          status: 'open' | 'matching' | 'closed';
          entry_count: number;
          started_at: string;
          closed_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['rounds']['Row']>;
        Update: Partial<Database['public']['Tables']['rounds']['Row']>;
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
        Insert: Omit<Database['public']['Tables']['submissions']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['submissions']['Row']>;
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
        Insert: Omit<Database['public']['Tables']['matches']['Row'], 'id' | 'created_at' | 'winner_id' | 'votes_a' | 'votes_b' | 'status'>;
        Update: Partial<Database['public']['Tables']['matches']['Row']>;
      };
      votes: {
        Row: {
          id: string;
          user_id: string;
          match_id: string;
          voted_for_id: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['votes']['Row'], 'id' | 'created_at'>;
        Update: never;
      };
    };
  };
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Round = Database['public']['Tables']['rounds']['Row'];
export type Submission = Database['public']['Tables']['submissions']['Row'];
export type Match = Database['public']['Tables']['matches']['Row'];
export type Vote = Database['public']['Tables']['votes']['Row'];

export interface ArrangementData {
  bpm: number;
  grids: Record<string, boolean[][]>;
  timeline: Array<{
    id: string;
    patternId: string;
    moduleType: string;
    startSec: number;
    durationSec: number;
  }>;
}
