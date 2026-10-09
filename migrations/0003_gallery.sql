-- Ring film: albums of photos and fight videos for signed-in members.
-- Photo files and short clips live in gallery_blobs. Long fight videos are links.

create table if not exists gallery_albums (
  id serial primary key,
  title text not null,
  event_date date,
  notes text not null default '',
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists gallery_items (
  id serial primary key,
  album_id integer not null references gallery_albums(id) on delete cascade,
  kind text not null check (kind in ('photo', 'video')),
  title text not null,
  athlete text not null default '',
  discipline text not null default '',
  caption text not null default '',
  poster text not null default '',
  video_url text not null default '',
  is_sample boolean not null default false,
  added_by text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists gallery_blobs (
  item_id integer primary key references gallery_items(id) on delete cascade,
  data text not null
);

create index if not exists gallery_items_album_idx on gallery_items (album_id);

insert into gallery_albums (title, event_date, notes, is_sample) values
  ('Detroit Classic', '2026-10-03', 'Season finale. Ring photos and a forms clip.', true),
  ('Ultimate Warrior Challenge', '2026-09-12', 'Battle Creek. AAA weekend.', true),
  ('On the floor', null, 'Class nights at the dojo.', true),
  ('Team uploads', null, 'Photos and links the team adds. This album stays when sample data is cleared.', false);

insert into gallery_items (album_id, kind, title, athlete, discipline, caption, poster, video_url, is_sample)
select id, 'photo', 'Forms run', 'Maya Hale', 'Forms', 'Intermediate forms on the blue mat.', '/media/gallery/forms.jpg', '', true
from gallery_albums where title = 'Detroit Classic';

insert into gallery_items (album_id, kind, title, athlete, discipline, caption, poster, video_url, is_sample)
select id, 'photo', 'Points sparring', 'Amara Okonkwo', 'Sparring', 'Chest gear on, kick already out.', '/media/gallery/sparring.jpg', '', true
from gallery_albums where title = 'Detroit Classic';

insert into gallery_items (album_id, kind, title, athlete, discipline, caption, poster, video_url, is_sample)
select id, 'video', 'Forms film', 'Maya Hale', 'Forms', 'Short clip from the same ring. Full matches are usually a link.', '/media/gallery/forms.jpg', '/media/gallery/forms-clip.mp4', true
from gallery_albums where title = 'Detroit Classic';

insert into gallery_items (album_id, kind, title, athlete, discipline, caption, poster, video_url, is_sample)
select id, 'photo', 'Weapons final', 'Sofia Reyes', 'Weapons', 'Gold from the weapons ring.', '/media/gallery/medal.jpg', '', true
from gallery_albums where title = 'Ultimate Warrior Challenge';

insert into gallery_items (album_id, kind, title, athlete, discipline, caption, poster, video_url, is_sample)
select id, 'photo', 'Bo staff', 'Jonah Ellis', 'Weapons', 'Staff run on the competition mat.', '/media/gallery/weapons.jpg', '', true
from gallery_albums where title = 'Ultimate Warrior Challenge';

insert into gallery_items (album_id, kind, title, athlete, discipline, caption, poster, video_url, is_sample)
select id, 'photo', 'Tuesday bow', '', 'Class', 'Line up, then bow in.', '/media/gallery/floor.jpg', '', true
from gallery_albums where title = 'On the floor';
