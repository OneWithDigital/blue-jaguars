-- Replace the age-split sample week with one class for the whole team.
delete from class_sessions where is_sample = true;

insert into class_sessions (weekday, start_time, end_time, title, room, instructor, ages, focus, is_sample) values
  (1, '17:30', '18:30', 'Regular class', 'Main floor', 'Sensei Marcus Hale', 'All ages', 'Basics, combinations, and class', true),
  (3, '17:30', '18:30', 'Regular class', 'Main floor', 'Sensei Marcus Hale', 'All ages', 'Basics, combinations, and class', true),
  (4, '17:30', '18:30', 'Forms training', 'Main floor', 'Sensei Elena Park', 'All ages', 'Forms lines and timing', true),
  (5, '17:30', '19:00', 'Fight night', 'Main floor', 'Coach Andre Brooks', 'All ages', 'Sparring and ring craft', true),
  (0, '10:00', '11:30', 'Open gym', 'Main floor', 'Sensei Marcus Hale', 'All ages', 'Open floor', true);

update instructors
set bio = 'Runs Thursday forms training. Precise, patient, and loud when the line drifts.'
where name = 'Elena Park' and is_sample = true;

update instructors
set bio = 'Runs Friday fight night and keeps the sparring honest.'
where name = 'Andre Brooks' and is_sample = true;

update students
set notes = 'Newest on the regular class. Parent stays mat-side.'
where student_name = 'Hana Chen' and is_sample = true and notes like 'Little Jaguars%';
