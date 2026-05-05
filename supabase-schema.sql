-- ============================================================
-- DoubtHub — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─── Subjects ─────────────────────────────────────────────
create table subjects (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  emoji         text default '📘',
  created_by_name text not null default 'Anonymous',
  created_at    timestamptz default now()
);

-- ─── Questions ────────────────────────────────────────────
create table questions (
  id              uuid primary key default gen_random_uuid(),
  subject_id      uuid not null references subjects(id) on delete cascade,
  title           text not null,
  description     text,
  status          text not null default 'unsolved'
                    check (status in ('unsolved', 'in_progress', 'solved')),
  uploaded_by_name text not null default 'Anonymous',
  user_id         text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── Question Images ───────────────────────────────────────
create table question_images (
  id            uuid primary key default gen_random_uuid(),
  question_id   uuid not null references questions(id) on delete cascade,
  storage_path  text not null,
  page_order    int  not null default 0,
  created_at    timestamptz default now()
);

-- ─── Solutions ─────────────────────────────────────────────
create table solutions (
  id                uuid primary key default gen_random_uuid(),
  question_id       uuid not null references questions(id) on delete cascade,
  text_content      text,
  created_by_name   text not null default 'Anonymous',
  user_id           text,
  updated_by_name   text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ─── Solution Images ───────────────────────────────────────
create table solution_images (
  id            uuid primary key default gen_random_uuid(),
  solution_id   uuid not null references solutions(id) on delete cascade,
  storage_path  text not null,
  page_order    int  not null default 0,
  created_at    timestamptz default now()
);

-- ─── Indexes ────────────────────────────────────────────────
create index on questions(subject_id);
create index on question_images(question_id);
create index on solutions(question_id);
create index on solution_images(solution_id);

-- ─── Row Level Security (Public Access — No Auth) ──────────
-- Allow everyone to read/write everything (no auth required)
alter table subjects        enable row level security;
alter table questions       enable row level security;
alter table question_images enable row level security;
alter table solutions       enable row level security;
alter table solution_images enable row level security;

-- Public read
create policy "public read subjects"        on subjects        for select using (true);
create policy "public read questions"       on questions       for select using (true);
create policy "public read question_images" on question_images for select using (true);
create policy "public read solutions"       on solutions       for select using (true);
create policy "public read solution_images" on solution_images for select using (true);

-- Public write
create policy "public insert subjects"        on subjects        for insert with check (true);
create policy "public insert questions"       on questions       for insert with check (true);
create policy "public insert question_images" on question_images for insert with check (true);
create policy "public insert solutions"       on solutions       for insert with check (true);
create policy "public insert solution_images" on solution_images for insert with check (true);

-- Public update
create policy "public update subjects"    on subjects    for update using (true);
create policy "public update questions"   on questions   for update using (true);
create policy "public update solutions"   on solutions   for update using (true);

-- Public delete
create policy "public delete subjects"        on subjects        for delete using (true);
create policy "public delete questions"       on questions       for delete using (true);
create policy "public delete question_images" on question_images for delete using (true);
create policy "public delete solutions"       on solutions       for delete using (true);
create policy "public delete solution_images" on solution_images for delete using (true);

-- ============================================================
-- STORAGE SETUP
-- ============================================================

-- Create the public storage bucket
insert into storage.buckets (id, name, public)
values ('doubt-images', 'doubt-images', true)
on conflict (id) do nothing;

-- Public upload
create policy "public upload"
  on storage.objects for insert
  with check ( bucket_id = 'doubt-images' );

-- Public read
create policy "public read"
  on storage.objects for select
  using ( bucket_id = 'doubt-images' );

-- Public delete
create policy "public delete"
  on storage.objects for delete
  using ( bucket_id = 'doubt-images' );
