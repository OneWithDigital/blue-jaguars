-- Upcoming events from the national circuits (AKA Warrior Cup / NASKA).
-- Safe to run more than once: each row is added only if an event with the
-- same name and date is not already on the calendar. Instructors can edit or
-- remove these from Events like any other event.

insert into tournaments (name, event_date, rating, presenter, venue, info_url, notes, is_sample)
select 'AKA Warrior Cup 2027', '2027-01-21', '', 'AKA Warrior Cup',
       'Hyatt Regency Chicago, 151 E. Wacker Dr., Chicago, IL',
       'https://www.mataction.com/aka-warrior-cup',
       'NASKA World Tour 6A. Runs January 21 to 23, 2027. Register through MAT Action. Event info: akawarriorcup.com',
       false
where not exists (
  select 1 from tournaments where name = 'AKA Warrior Cup 2027' and event_date = '2027-01-21'
);

insert into tournaments (name, event_date, rating, presenter, venue, info_url, notes, is_sample)
select 'NASKA Awards Banquet', '2027-01-21', '', 'NASKA',
       'Chicago, IL (Warrior Cup weekend)',
       'https://naskabanquet.com/',
       'Honors the 2026 NASKA season. Thursday night of Warrior Cup weekend.',
       false
where not exists (
  select 1 from tournaments where name = 'NASKA Awards Banquet' and event_date = '2027-01-21'
);
