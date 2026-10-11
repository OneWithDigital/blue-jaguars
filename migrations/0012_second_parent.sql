-- A second parent or guardian who can also edit the athlete's card and check
-- the athlete in for class.
alter table students add column if not exists parent2_name text not null default '';
alter table students add column if not exists parent2_email text not null default '';
alter table students add column if not exists parent2_phone text not null default '';
