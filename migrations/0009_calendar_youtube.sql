-- Calendar: weekly classes can have a start and end date, one-off classes sit on
-- a single date, and a weekly class can be skipped on a given date.
alter table class_sessions add column if not exists one_off_date date;
alter table class_sessions add column if not exists starts_on date;
alter table class_sessions add column if not exists ends_on date;
alter table class_sessions alter column ages set default '';

create table if not exists class_skips (
  class_id integer not null references class_sessions(id) on delete cascade,
  day date not null,
  primary key (class_id, day)
);

-- YouTube: public channel videos are imported into a Film album automatically.
alter table dojo_settings add column if not exists youtube_channel_id text not null default 'UCQj_RvXqm3XJIhDZ7BC851w';
alter table dojo_settings add column if not exists youtube_synced_at timestamptz;

alter table gallery_albums add column if not exists source text not null default '';
alter table gallery_items add column if not exists youtube_id text;
create unique index if not exists gallery_items_youtube_id_idx on gallery_items (youtube_id);
