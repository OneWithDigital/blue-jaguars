alter table dojo_members drop constraint if exists dojo_members_role_check;
alter table dojo_members add constraint dojo_members_role_check check (role in ('member', 'instructor', 'owner'));

alter table dojo_settings add column if not exists wifi_name text not null default '';
alter table dojo_settings add column if not exists wifi_password text not null default '';
alter table dojo_settings add column if not exists dues_url text not null default 'https://pay.bluevine.com/p/1fc7333c0eae44ddb9c5f67727fd4f08/pay/';
alter table dojo_settings add column if not exists owner_email text not null default 'erikedgington@gmail.com';

alter table students add column if not exists has_key boolean not null default false;

create table if not exists attendance (
  student_id integer not null references students(id) on delete cascade,
  day date not null,
  going boolean not null,
  primary key (student_id, day)
);

create table if not exists dues (
  student_id integer not null references students(id) on delete cascade,
  month text not null,
  paid boolean not null default false,
  primary key (student_id, month)
);

create table if not exists board_posts (
  id serial primary key,
  user_id text not null,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);
