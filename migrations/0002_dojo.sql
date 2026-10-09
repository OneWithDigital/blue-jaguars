-- Blue Jaguars team room. Shared dojo data, readable only by signed-in members.
-- Writes are checked in server functions (instructor vs member), not by user_id,
-- because the roster and schedule belong to the team, not to one account.

create table if not exists dojo_settings (
  id integer primary key,
  name text not null,
  city text not null,
  motto text not null,
  about text not null,
  member_code text not null,
  instructor_code text not null,
  constraint dojo_settings_singleton check (id = 1)
);

create table if not exists dojo_members (
  user_id text primary key,
  role text not null check (role in ('member', 'instructor')),
  joined_at timestamptz not null default now()
);

create table if not exists class_sessions (
  id serial primary key,
  weekday integer not null check (weekday between 0 and 6),
  start_time text not null,
  end_time text not null,
  title text not null,
  room text not null,
  instructor text not null,
  ages text not null,
  focus text not null,
  is_sample boolean not null default false
);

create table if not exists tournaments (
  id serial primary key,
  name text not null,
  event_date date not null,
  rating text not null default '',
  presenter text not null default '',
  venue text not null default '',
  info_url text not null default '',
  notes text not null default '',
  is_sample boolean not null default false
);

create table if not exists cleaning_weeks (
  id serial primary key,
  week_start date not null,
  family_name text not null,
  tasks text not null,
  done boolean not null default false,
  is_sample boolean not null default false
);

create table if not exists instructors (
  id serial primary key,
  name text not null,
  rank text not null,
  role text not null,
  bio text not null default '',
  email text not null default '',
  phone text not null default '',
  is_sample boolean not null default false
);

create table if not exists students (
  id serial primary key,
  student_name text not null,
  belt text not null,
  age integer,
  parent_name text not null,
  parent_email text not null default '',
  parent_phone text not null default '',
  notes text not null default '',
  is_sample boolean not null default false
);

create table if not exists vendors (
  id serial primary key,
  name text not null,
  url text not null,
  blurb text not null default '',
  category text not null default ''
);

create table if not exists mskc_results (
  id serial primary key,
  student_name text not null,
  division text not null,
  discipline text not null,
  event_name text not null,
  event_date date not null,
  rating text not null,
  place integer not null check (place between 1 and 4),
  points integer not null,
  is_sample boolean not null default false
);

insert into dojo_settings (id, name, city, motto, about, member_code, instructor_code)
values (
  1,
  'Blue Jaguars',
  'Michigan',
  'Own the moment.',
  'The team room for Blue Jaguars: class times, the cleaning rotation, the phone tree, and where we stand on the Michigan Sport Karate Circuit.',
  'JAGUARS',
  'SENSEI'
)
on conflict (id) do nothing;

insert into class_sessions (weekday, start_time, end_time, title, room, instructor, ages, focus, is_sample) values
  (1, '17:30', '18:30', 'Regular class', 'Main floor', 'Sensei Marcus Hale', 'All ages', 'Basics, combinations, and class', true),
  (3, '17:30', '18:30', 'Regular class', 'Main floor', 'Sensei Marcus Hale', 'All ages', 'Basics, combinations, and class', true),
  (4, '17:30', '18:30', 'Forms training', 'Main floor', 'Sensei Elena Park', 'All ages', 'Forms lines and timing', true),
  (5, '17:30', '19:00', 'Fight night', 'Main floor', 'Coach Andre Brooks', 'All ages', 'Sparring and ring craft', true),
  (0, '10:00', '11:30', 'Open gym', 'Main floor', 'Sensei Marcus Hale', 'All ages', 'Open floor', true);

insert into tournaments (name, event_date, rating, presenter, venue, info_url, notes, is_sample) values
  (
    'HSMA Open',
    '2026-04-11',
    'AAA',
    'Hayme Serrato''s Martial Arts',
    'Brandon High School, Ortonville, MI',
    'http://www.mskctour.com/Events.aspx',
    'On the public MSKC calendar. Confirm the flyer before you travel.',
    false
  ),
  (
    'MSKO',
    '2026-05-23',
    'AAA',
    'MSKC',
    'See the MSKC flyer',
    'http://www.mskctour.com/Events.aspx',
    'Listed on the circuit calendar. Venue is on the flyer.',
    false
  ),
  (
    'Ultimate Warrior Challenge',
    '2026-09-12',
    'AAA',
    'K.I. Tang Soo Do Foundation',
    'Battle Creek Central High School',
    'http://www.mskctour.com/Events.aspx',
    'AAA rated. Confirm divisions on the flyer.',
    false
  ),
  (
    'Detroit Classic',
    '2026-10-03',
    'AAA',
    'Metropolitan Karate Academy',
    'See the MSKC flyer',
    'http://www.mskctour.com/Events.aspx',
    'Season finale on the circuit. Points are usually posted in the MSKC Facebook group.',
    false
  ),
  (
    'MSKC Banquet',
    '2026-12-06',
    '',
    'Task Karate',
    'Baker''s of Milford, 2025 S Milford Rd, Milford, MI',
    'http://taskkarate.com/events',
    'Champions banquet, 1:00–4:00 PM. Not a rated tournament.',
    false
  );

insert into instructors (name, rank, role, bio, email, phone, is_sample) values
  (
    'Marcus Hale',
    '4th dan',
    'Head instructor',
    'Started Blue Jaguars so Michigan kids could chase circuit rings without dropping the dojo habits: bow, listen, hit the mark.',
    'marcus.hale@example.com',
    '(248) 555-0101',
    true
  ),
  (
    'Elena Park',
    '2nd dan',
    'Forms & weapons',
    'Runs Thursday forms training. Precise, patient, and loud when the line drifts.',
    'elena.park@example.com',
    '(248) 555-0108',
    true
  ),
  (
    'Andre Brooks',
    '1st dan',
    'Sparring coach',
    'Runs Friday fight night and keeps the sparring honest.',
    'andre.brooks@example.com',
    '(248) 555-0114',
    true
  );

insert into students (student_name, belt, age, parent_name, parent_email, parent_phone, notes, is_sample) values
  ('Maya Hale', 'Blue', 11, 'Jordan Hale', 'jordan.hale@example.com', '(248) 555-0142', 'Competition team. Forms and weapons.', true),
  ('Leo Hale', 'Orange', 8, 'Jordan Hale', 'jordan.hale@example.com', '(248) 555-0142', 'Little brother. Still learning to hold the chamber.', true),
  ('Amara Okonkwo', 'Purple', 12, 'Chioma Okonkwo', 'chioma.okonkwo@example.com', '(734) 555-0177', 'Sparring. Needs a new mouthguard before banquet photos.', true),
  ('Noah Navarro', 'Green', 10, 'Elena Navarro', 'elena.navarro@example.com', '(586) 555-0133', 'Forms. Ask before swapping his bo staff.', true),
  ('Priya Patel', 'Yellow', 9, 'Raj Patel', 'raj.patel@example.com', '(248) 555-0190', 'Beginner forms. Confident in the ring already.', true),
  ('Caleb Brooks', 'Brown', 13, 'Andre Brooks', 'andre.brooks@example.com', '(248) 555-0114', 'Sparring captain on the sample card.', true),
  ('Hana Chen', 'White', 7, 'Mei Chen', 'mei.chen@example.com', '(313) 555-0164', 'Newest on the regular class. Parent stays mat-side.', true),
  ('Jonah Ellis', 'Blue', 11, 'Sam Ellis', 'sam.ellis@example.com', '(810) 555-0128', 'Weapons. Left-side stance.', true),
  ('Sofia Reyes', 'Red', 14, 'Luz Reyes', 'luz.reyes@example.com', '(734) 555-0182', 'Weapons leader on the sample card.', true),
  ('Miles Grant', 'White', 6, 'Taylor Grant', 'taylor.grant@example.com', '(248) 555-0155', 'Newest little jaguar.', true);

insert into cleaning_weeks (week_start, family_name, tasks, done, is_sample) values
  ('2026-10-05', 'Hale family', 'Sweep the floor, wipe the mirrors, empty the trash, fold spare belts.', false, true),
  ('2026-10-12', 'Okonkwo family', 'Sweep the floor, wipe the mirrors, empty the trash, restock the water cups.', false, true),
  ('2026-10-19', 'Navarro family', 'Sweep the floor, wipe the mirrors, take the trash out, straighten the weapon rack.', false, true),
  ('2026-10-26', 'Brooks family', 'Sweep the floor, wipe the mirrors, empty the trash, check the first-aid kit.', false, true),
  ('2026-11-02', 'Chen family', 'Sweep the floor, wipe the mirrors, empty the trash, fold spare belts.', false, true),
  ('2026-11-09', 'Patel family', 'Sweep the floor, wipe the mirrors, empty the trash, wipe the door glass.', false, true);

insert into vendors (name, url, blurb, category) values
  ('Century Martial Arts', 'https://www.centurymartialarts.com/', 'Gis, sparring gear, and bags.', 'Gear'),
  ('Asian World of Martial Arts', 'https://www.awma.com/', 'Belts, weapons, and patches.', 'Gear'),
  ('Tiger Claw', 'https://www.tigerclaw.com/', 'Shoes, gloves, and tournament gear.', 'Gear'),
  ('KarateMart', 'https://www.karatemart.com/', 'Student kits and breaking boards.', 'Gear'),
  ('MSKC Tour', 'http://www.mskctour.com/', 'Michigan Sport Karate Circuit calendar and event pages.', 'Circuit'),
  ('MSKC on Facebook', 'https://www.facebook.com/groups/418643128526357/', 'Where the circuit posts flyers and when points go up.', 'Circuit');

insert into mskc_results (student_name, division, discipline, event_name, event_date, rating, place, points, is_sample) values
  ('Sofia Reyes', 'Youth 14–15 Advanced', 'Weapons', 'HSMA Open', '2026-04-11', 'AAA', 1, 100, true),
  ('Sofia Reyes', 'Youth 14–15 Advanced', 'Weapons', 'Ultimate Warrior Challenge', '2026-09-12', 'AAA', 1, 100, true),
  ('Sofia Reyes', 'Youth 14–15 Advanced', 'Weapons', 'Detroit Classic', '2026-10-03', 'AAA', 1, 100, true),
  ('Maya Hale', 'Youth 10–11 Intermediate', 'Forms', 'HSMA Open', '2026-04-11', 'AAA', 1, 100, true),
  ('Maya Hale', 'Youth 10–11 Intermediate', 'Weapons', 'HSMA Open', '2026-04-11', 'AAA', 2, 80, true),
  ('Maya Hale', 'Youth 10–11 Intermediate', 'Forms', 'Ultimate Warrior Challenge', '2026-09-12', 'AAA', 1, 100, true),
  ('Maya Hale', 'Youth 10–11 Intermediate', 'Forms', 'Detroit Classic', '2026-10-03', 'AAA', 2, 80, true),
  ('Amara Okonkwo', 'Youth 12–13 Advanced', 'Sparring', 'HSMA Open', '2026-04-11', 'AAA', 2, 80, true),
  ('Amara Okonkwo', 'Youth 12–13 Advanced', 'Sparring', 'Ultimate Warrior Challenge', '2026-09-12', 'AAA', 1, 100, true),
  ('Amara Okonkwo', 'Youth 12–13 Advanced', 'Sparring', 'Detroit Classic', '2026-10-03', 'AAA', 1, 100, true),
  ('Caleb Brooks', 'Youth 12–13 Advanced', 'Sparring', 'HSMA Open', '2026-04-11', 'AAA', 1, 100, true),
  ('Caleb Brooks', 'Youth 12–13 Advanced', 'Sparring', 'Ultimate Warrior Challenge', '2026-09-12', 'AAA', 3, 60, true),
  ('Caleb Brooks', 'Youth 12–13 Advanced', 'Sparring', 'Detroit Classic', '2026-10-03', 'AAA', 2, 80, true),
  ('Noah Navarro', 'Youth 10–11 Intermediate', 'Forms', 'HSMA Open', '2026-04-11', 'AAA', 3, 60, true),
  ('Noah Navarro', 'Youth 10–11 Intermediate', 'Forms', 'Ultimate Warrior Challenge', '2026-09-12', 'AAA', 2, 80, true),
  ('Noah Navarro', 'Youth 10–11 Intermediate', 'Forms', 'Detroit Classic', '2026-10-03', 'AAA', 3, 60, true),
  ('Priya Patel', 'Youth 8–9 Beginner', 'Forms', 'Ultimate Warrior Challenge', '2026-09-12', 'AAA', 1, 100, true),
  ('Priya Patel', 'Youth 8–9 Beginner', 'Forms', 'Detroit Classic', '2026-10-03', 'AAA', 1, 100, true),
  ('Jonah Ellis', 'Youth 10–11 Intermediate', 'Weapons', 'Ultimate Warrior Challenge', '2026-09-12', 'AAA', 3, 60, true),
  ('Jonah Ellis', 'Youth 10–11 Intermediate', 'Weapons', 'Detroit Classic', '2026-10-03', 'AAA', 2, 80, true),
  ('Leo Hale', 'Youth 8–9 Beginner', 'Forms', 'Detroit Classic', '2026-10-03', 'AAA', 4, 40, true);
