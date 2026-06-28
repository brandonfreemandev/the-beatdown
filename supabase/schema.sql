-- ============================================================
-- The Beatdown — Supabase Schema
-- Run this in the Supabase SQL editor
-- ============================================================

-- Profiles (extends auth.users)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  username text,
  avatar_url text,
  elo_rating integer not null default 1000,
  votes_cast integer not null default 0,
  submissions_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Rounds
create table if not exists rounds (
  id uuid default gen_random_uuid() primary key,
  status text not null default 'open' check (status in ('open', 'matching', 'closed')),
  entry_count integer not null default 0,
  started_at timestamptz not null default now(),
  closed_at timestamptz
);

-- Seed an initial open round
insert into rounds (status) values ('open') on conflict do nothing;

-- Submissions
create table if not exists submissions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  round_id uuid references rounds(id) not null,
  title text not null,
  arrangement jsonb not null,
  created_at timestamptz not null default now()
);

-- Increment round entry_count on submission
create or replace function handle_new_submission()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update rounds set entry_count = entry_count + 1 where id = new.round_id;
  update profiles set submissions_count = submissions_count + 1 where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists on_submission_created on submissions;
create trigger on_submission_created
  after insert on submissions
  for each row execute procedure handle_new_submission();

-- Matches
create table if not exists matches (
  id uuid default gen_random_uuid() primary key,
  round_id uuid references rounds(id) not null,
  track_a_id uuid references submissions(id) not null,
  track_b_id uuid references submissions(id) not null,
  winner_id uuid references submissions(id),
  votes_a integer not null default 0,
  votes_b integer not null default 0,
  status text not null default 'active' check (status in ('active', 'resolved')),
  created_at timestamptz not null default now()
);

-- Votes
create table if not exists votes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  match_id uuid references matches(id) not null,
  voted_for_id uuid references submissions(id) not null,
  created_at timestamptz not null default now(),
  unique(user_id, match_id)
);

-- Increment vote counts + votes_cast on user profile
create or replace function handle_new_vote()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Update match vote counts
  if new.voted_for_id = (select track_a_id from matches where id = new.match_id) then
    update matches set votes_a = votes_a + 1 where id = new.match_id;
  else
    update matches set votes_b = votes_b + 1 where id = new.match_id;
  end if;
  -- Update user votes_cast
  update profiles set votes_cast = votes_cast + 1 where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists on_vote_created on votes;
create trigger on_vote_created
  after insert on votes
  for each row execute procedure handle_new_vote();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table profiles enable row level security;
alter table rounds enable row level security;
alter table submissions enable row level security;
alter table matches enable row level security;
alter table votes enable row level security;

-- Profiles: read all, write own
create policy "profiles_read_all" on profiles for select using (true);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- Rounds: read all
create policy "rounds_read_all" on rounds for select using (true);

-- Submissions: read all, insert own
create policy "submissions_read_all" on submissions for select using (true);
create policy "submissions_insert_own" on submissions for insert with check (auth.uid() = user_id);

-- Matches: read all
create policy "matches_read_all" on matches for select using (true);

-- Votes: read all, insert own, no duplicates enforced by unique constraint
create policy "votes_read_all" on votes for select using (true);
create policy "votes_insert_own" on votes for insert with check (auth.uid() = user_id);

-- ============================================================
-- ELO update function (called by matchmaker after match resolves)
-- ============================================================
create or replace function resolve_match(
  p_match_id uuid,
  p_winner_id uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_match matches%rowtype;
  v_winner_user uuid;
  v_loser_user uuid;
  v_loser_id uuid;
  v_winner_elo integer;
  v_loser_elo integer;
  k constant integer := 32;
  expected_winner float;
  delta integer;
begin
  select * into v_match from matches where id = p_match_id;
  v_loser_id := case when p_winner_id = v_match.track_a_id then v_match.track_b_id else v_match.track_a_id end;
  select user_id into v_winner_user from submissions where id = p_winner_id;
  select user_id into v_loser_user from submissions where id = v_loser_id;
  select elo_rating into v_winner_elo from profiles where id = v_winner_user;
  select elo_rating into v_loser_elo from profiles where id = v_loser_user;
  expected_winner := 1.0 / (1.0 + power(10.0, (v_loser_elo - v_winner_elo) / 400.0));
  delta := round(k * (1 - expected_winner));
  update profiles set elo_rating = elo_rating + delta where id = v_winner_user;
  update profiles set elo_rating = greatest(100, elo_rating - delta) where id = v_loser_user;
  update matches set winner_id = p_winner_id, status = 'resolved' where id = p_match_id;
end;
$$;
