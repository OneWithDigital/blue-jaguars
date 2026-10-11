-- Parents add their own athletes, profiles get a photo and a record, a first-run
-- tour for every member, and a site feedback inbox for admins.

alter table students add column if not exists weapon text not null default '';
alter table students add column if not exists wins integer not null default 0;
alter table students add column if not exists losses integer not null default 0;
-- Medals from tournaments outside the MSKC results the instructors log.
alter table students add column if not exists other_gold integer not null default 0;
alter table students add column if not exists other_silver integer not null default 0;
alter table students add column if not exists other_bronze integer not null default 0;
alter table students add column if not exists photo_version integer not null default 0;
alter table students add column if not exists added_by text not null default '';

create table if not exists student_photos (
  student_id integer primary key references students(id) on delete cascade,
  data text not null,
  updated_at timestamptz not null default now()
);

alter table dojo_members add column if not exists tour_done boolean not null default false;

create table if not exists site_feedback (
  id serial primary key,
  user_id text not null,
  author_name text not null default '',
  author_email text not null default '',
  kind text not null default 'idea' check (kind in ('idea', 'problem', 'other')),
  page text not null default '',
  message text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
