-- ============================================================
-- 2026-09-29 — Anonymous one-tap voting + battle time-box
-- Run in the Supabase SQL editor (or supabase db push).
-- ============================================================

-- Votes may now come from anonymous voters identified only by a cookie key.
alter table votes alter column user_id drop not null;
alter table votes add column if not exists voter_key text;

-- One vote per anonymous identity per match (logged-in uniqueness stays on
-- the existing unique(user_id, match_id) constraint).
create unique index if not exists votes_voter_key_match_unique
  on votes (voter_key, match_id)
  where voter_key is not null;

-- Time-boxed battles: a draw closes a match with no winner and no ELO change.
create or replace function resolve_match_draw(
  p_match_id uuid
) returns void language plpgsql security definer set search_path = public as $$
begin
  update matches set status = 'resolved' where id = p_match_id and status = 'active';
end;
$$;
