alter table students add column if not exists gender text not null default '';
alter table students add column if not exists skill text not null default '';
alter table students add column if not exists style text not null default '';
alter table students add column if not exists events text not null default '';
alter table students add column if not exists weight_class text not null default '';

update students set gender = 'girl', skill = 'INT', events = 'Forms,Weapons' where student_name = 'Maya Hale' and is_sample = true;
update students set gender = 'boy', skill = 'NOV', events = 'Forms' where student_name = 'Leo Hale' and is_sample = true;
update students set gender = 'girl', skill = 'ADV', events = 'Point Fighting' where student_name = 'Amara Okonkwo' and is_sample = true;
update students set gender = 'boy', skill = 'INT', events = 'Forms' where student_name = 'Noah Navarro' and is_sample = true;
update students set gender = 'girl', skill = 'NOV', events = 'Forms' where student_name = 'Priya Patel' and is_sample = true;
update students set gender = 'boy', skill = 'ADV', events = 'Point Fighting' where student_name = 'Caleb Brooks' and is_sample = true;
update students set gender = 'girl', skill = 'NOV' where student_name = 'Hana Chen' and is_sample = true;
update students set gender = 'boy', skill = 'ADV', events = 'Weapons' where student_name = 'Jonah Ellis' and is_sample = true;
update students set gender = 'girl', skill = 'ADV', events = 'Forms,Weapons' where student_name = 'Sofia Reyes' and is_sample = true;
update students set gender = 'boy', skill = 'NOV' where student_name = 'Miles Grant' and is_sample = true;
