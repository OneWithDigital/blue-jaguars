-- Books: the owner's record of dojo spending. Amounts are stored in cents.

create table if not exists expense_projects (
  id serial primary key,
  name text not null,
  budget_cents integer not null default 0 check (budget_cents >= 0),
  target_date date,
  status text not null default 'active' check (status in ('active', 'done')),
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- Bills that repeat every month (rent, instructor pay). Logged as a real
-- expense each month with one tap.
create table if not exists expense_recurring (
  id serial primary key,
  category text not null,
  payee text not null default '',
  description text not null default '',
  amount_cents integer not null check (amount_cents > 0),
  day_of_month integer not null default 1 check (day_of_month between 1 and 28),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists expenses (
  id serial primary key,
  spent_on date not null,
  category text not null,
  payee text not null default '',
  description text not null default '',
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'paid' check (status in ('paid', 'planned')),
  project_id integer references expense_projects(id) on delete set null,
  recurring_id integer references expense_recurring(id) on delete set null,
  created_by text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists expenses_spent_on_idx on expenses (spent_on);
create index if not exists expenses_project_idx on expenses (project_id);
-- One logged entry per recurring bill per month.
create unique index if not exists expenses_recurring_month_idx
  on expenses (recurring_id, date_trunc('month', spent_on::timestamp))
  where recurring_id is not null;

create table if not exists expense_receipts (
  expense_id integer primary key references expenses(id) on delete cascade,
  data text not null
);
