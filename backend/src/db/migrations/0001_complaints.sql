-- Complaints and their comment threads.
--
-- Additive only: two new tables and their indexes. Nothing existing is read,
-- altered or dropped, so this is safe to apply to the live database. Written
-- by hand rather than generated, because `drizzle-kit push` diffs the whole
-- schema and would act on any drift it found elsewhere.

create table if not exists complaints (
  id               text primary key,
  team_id          text not null,
  title            text not null,
  details          text not null default '',
  against          text not null default '',
  status           text not null default 'Open',
  raised_by_id     text not null,
  raised_by_name   text not null,
  resolved_by_id   text,
  resolved_by_name text,
  resolved_at      timestamp,
  created_at       timestamp not null default now(),
  updated_at       timestamp not null default now()
);
create index if not exists complaints_team_idx   on complaints (team_id);
create index if not exists complaints_status_idx on complaints (status);

create table if not exists complaint_comments (
  id           text primary key,
  complaint_id text not null,
  author_id    text not null,
  author_name  text not null,
  text         text not null,
  created_at   timestamp not null default now()
);
create index if not exists complaint_comments_complaint_idx on complaint_comments (complaint_id);

-- Match every other table: RLS on, and no direct access for the browser-facing
-- Supabase roles. All reads and writes go through the API.
alter table complaints         enable row level security;
alter table complaint_comments enable row level security;
revoke all on complaints         from anon, authenticated;
revoke all on complaint_comments from anon, authenticated;
