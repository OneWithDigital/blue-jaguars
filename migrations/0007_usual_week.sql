create table if not exists attendance_usual (
  student_id integer not null references students(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  going boolean not null,
  primary key (student_id, weekday)
);
