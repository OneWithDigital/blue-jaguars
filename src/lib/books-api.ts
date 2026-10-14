import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { EXPENSE_CATEGORIES } from "@/lib/books";

/**
 * Books: the dojo's spending record. Owner only, because it holds instructor
 * pay and rent. Amounts travel and are stored as whole cents.
 */

export type ExpenseRow = {
  id: number;
  spent_on: string;
  category: string;
  payee: string;
  description: string;
  amount_cents: number;
  status: "paid" | "planned";
  project_id: number | null;
  recurring_id: number | null;
  has_receipt: boolean;
};

export type ProjectRow = {
  id: number;
  name: string;
  budget_cents: number;
  target_date: string | null;
  status: "active" | "done";
  notes: string;
  spent_cents: number;
  planned_cents: number;
};

export type RecurringRow = {
  id: number;
  category: string;
  payee: string;
  description: string;
  amount_cents: number;
  day_of_month: number;
  active: boolean;
};

export type BooksData = {
  year: number;
  expenses: ExpenseRow[];
  projects: ProjectRow[];
  recurring: RecurringRow[];
};

function num(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function bool(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === 1;
}

function obj(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" ? (input as Record<string, unknown>) : {};
}

function text(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function idOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Pick from the list");
  return id;
}

function idOf(value: unknown): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Missing id");
  return id;
}

/** "1,234.56" or "$1234" or "1234.5" to cents. */
function cents(value: unknown, label: string, allowZero = false): number {
  const raw = String(value ?? "").replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new Error(`${label} should be a dollar amount like 125.00`);
  const amount = Math.round(Number(raw) * 100);
  if (!allowZero && amount <= 0) throw new Error(`${label} should be more than $0`);
  if (amount > 100_000_000) throw new Error(`${label} looks too large`);
  return amount;
}

function isoDate(value: unknown, label: string): string {
  const raw = text(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) throw new Error(`Pick a ${label}`);
  return raw;
}

function category(value: unknown): string {
  const raw = text(value, 40);
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(raw)) throw new Error("Pick a category");
  return raw;
}

async function requireOwner(userId: string): Promise<void> {
  const sql = await getSql();
  const rows = await sql<{ role: string }>`select role from dojo_members where user_id = ${userId} limit 1`;
  if (rows[0]?.role !== "owner") throw new Error("Only the owner can see the books");
}

/** Receipt image for one expense. Owner only (used by the receipt route). */
export async function receiptFor(userId: string, expenseId: number): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql<{ role: string }>`select role from dojo_members where user_id = ${userId} limit 1`;
  if (rows[0]?.role !== "owner") return null;
  const found = await sql<{ data: string }>`select data from expense_receipts where expense_id = ${expenseId}`;
  return found[0]?.data ?? null;
}

export const getBooks = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const year = Number(obj(input).year ?? new Date().getFullYear());
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("Pick a year");
    return { year };
  })
  .handler(async ({ context, data }): Promise<BooksData> => {
    await requireOwner(context.userId);
    const sql = await getSql();
    const from = `${data.year}-01-01`;
    const to = `${data.year + 1}-01-01`;
    const expenses = await sql<ExpenseRow>`
      select e.id, e.spent_on::text as spent_on, e.category, e.payee, e.description, e.amount_cents,
             e.status, e.project_id, e.recurring_id, (r.expense_id is not null) as has_receipt
      from expenses e
      left join expense_receipts r on r.expense_id = e.id
      where e.spent_on >= ${from}::date and e.spent_on < ${to}::date
      order by e.spent_on desc, e.id desc
    `;
    const projects = await sql<ProjectRow>`
      select p.id, p.name, p.budget_cents, p.target_date::text as target_date, p.status, p.notes,
             coalesce(sum(e.amount_cents) filter (where e.status = 'paid'), 0) as spent_cents,
             coalesce(sum(e.amount_cents) filter (where e.status = 'planned'), 0) as planned_cents
      from expense_projects p
      left join expenses e on e.project_id = p.id
      group by p.id
      order by (p.status = 'done'), p.created_at desc
    `;
    const recurring = await sql<RecurringRow>`
      select id, category, payee, description, amount_cents, day_of_month, active
      from expense_recurring
      order by active desc, day_of_month, id
    `;
    return {
      year: data.year,
      expenses: expenses.map((row) => ({
        ...row,
        id: num(row.id),
        amount_cents: num(row.amount_cents),
        status: row.status === "planned" ? "planned" : "paid",
        project_id: row.project_id == null ? null : num(row.project_id),
        recurring_id: row.recurring_id == null ? null : num(row.recurring_id),
        has_receipt: bool(row.has_receipt),
      })),
      projects: projects.map((row) => ({
        ...row,
        id: num(row.id),
        budget_cents: num(row.budget_cents),
        target_date: row.target_date || null,
        status: row.status === "done" ? "done" : "active",
        spent_cents: num(row.spent_cents),
        planned_cents: num(row.planned_cents),
      })),
      recurring: recurring.map((row) => ({
        ...row,
        id: num(row.id),
        amount_cents: num(row.amount_cents),
        day_of_month: num(row.day_of_month),
        active: bool(row.active),
      })),
    };
  });

const RECEIPT_MAX = 900_000;

export const saveExpense = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = obj(input);
    const receipt = raw.receipt == null ? undefined : String(raw.receipt).trim();
    if (receipt && (!/^data:image\/jpeg;base64,[a-z0-9+/=]+$/i.test(receipt) || receipt.length > RECEIPT_MAX)) {
      throw new Error("That receipt photo is too large or not a photo.");
    }
    return {
      id: raw.id == null || raw.id === "" ? null : idOf(raw.id),
      spent_on: isoDate(raw.spent_on, "date"),
      category: category(raw.category),
      payee: text(raw.payee, 80),
      description: text(raw.description, 240),
      amount_cents: cents(raw.amount, "Amount"),
      status: raw.status === "planned" ? ("planned" as const) : ("paid" as const),
      project_id: idOrNull(raw.project_id),
      // undefined = keep, "" = remove, data URL = replace
      receipt,
      repeat_monthly: raw.repeat_monthly === true || raw.repeat_monthly === "true",
    };
  })
  .handler(async ({ context, data }) => {
    await requireOwner(context.userId);
    const sql = await getSql();
    let id = data.id;
    if (id) {
      await sql`
        update expenses set
          spent_on = ${data.spent_on}, category = ${data.category}, payee = ${data.payee},
          description = ${data.description}, amount_cents = ${data.amount_cents}, status = ${data.status},
          project_id = ${data.project_id}
        where id = ${id}
      `;
    } else {
      let recurringId: number | null = null;
      if (data.repeat_monthly) {
        const day = Math.min(28, Number(data.spent_on.slice(8, 10)));
        const made = await sql<{ id: number }>`
          insert into expense_recurring (category, payee, description, amount_cents, day_of_month)
          values (${data.category}, ${data.payee}, ${data.description}, ${data.amount_cents}, ${day})
          returning id
        `;
        recurringId = num(made[0]?.id);
      }
      const made = await sql<{ id: number }>`
        insert into expenses (spent_on, category, payee, description, amount_cents, status, project_id, recurring_id, created_by)
        values (${data.spent_on}, ${data.category}, ${data.payee}, ${data.description}, ${data.amount_cents},
                ${data.status}, ${data.project_id}, ${recurringId}, ${context.userId})
        returning id
      `;
      id = num(made[0]?.id);
    }
    if (data.receipt !== undefined && id) {
      if (data.receipt) {
        await sql`
          insert into expense_receipts (expense_id, data) values (${id}, ${data.receipt})
          on conflict (expense_id) do update set data = excluded.data
        `;
      } else {
        await sql`delete from expense_receipts where expense_id = ${id}`;
      }
    }
    return { ok: true, id };
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: idOf(obj(input).id) }))
  .handler(async ({ context, data }) => {
    await requireOwner(context.userId);
    const sql = await getSql();
    await sql`delete from expenses where id = ${data.id}`;
    return { ok: true };
  });

export const markExpensePaid = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: idOf(obj(input).id) }))
  .handler(async ({ context, data }) => {
    await requireOwner(context.userId);
    const sql = await getSql();
    await sql`update expenses set status = 'paid' where id = ${data.id}`;
    return { ok: true };
  });

export const saveProject = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = obj(input);
    const name = text(raw.name, 80);
    if (!name) throw new Error("Name the project");
    const target = text(raw.target_date, 10);
    return {
      id: raw.id == null || raw.id === "" ? null : idOf(raw.id),
      name,
      budget_cents: String(raw.budget ?? "").trim() ? cents(raw.budget, "Budget", true) : 0,
      target_date: target ? isoDate(target, "target date") : null,
      status: raw.status === "done" ? ("done" as const) : ("active" as const),
      notes: text(raw.notes, 400),
    };
  })
  .handler(async ({ context, data }) => {
    await requireOwner(context.userId);
    const sql = await getSql();
    if (data.id) {
      await sql`
        update expense_projects set name = ${data.name}, budget_cents = ${data.budget_cents},
          target_date = ${data.target_date}, status = ${data.status}, notes = ${data.notes}
        where id = ${data.id}
      `;
      return { ok: true, id: data.id };
    }
    const made = await sql<{ id: number }>`
      insert into expense_projects (name, budget_cents, target_date, status, notes)
      values (${data.name}, ${data.budget_cents}, ${data.target_date}, ${data.status}, ${data.notes})
      returning id
    `;
    return { ok: true, id: num(made[0]?.id) };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: idOf(obj(input).id) }))
  .handler(async ({ context, data }) => {
    await requireOwner(context.userId);
    const sql = await getSql();
    // Expenses stay; they just lose the project tag.
    await sql`delete from expense_projects where id = ${data.id}`;
    return { ok: true };
  });

export const saveRecurring = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = obj(input);
    const day = Number(raw.day_of_month ?? 1);
    if (!Number.isInteger(day) || day < 1 || day > 28) throw new Error("Pick a day from 1 to 28");
    return {
      id: idOf(raw.id),
      category: category(raw.category),
      payee: text(raw.payee, 80),
      description: text(raw.description, 240),
      amount_cents: cents(raw.amount, "Amount"),
      day_of_month: day,
      active: !(raw.active === false || raw.active === "false"),
    };
  })
  .handler(async ({ context, data }) => {
    await requireOwner(context.userId);
    const sql = await getSql();
    await sql`
      update expense_recurring set category = ${data.category}, payee = ${data.payee},
        description = ${data.description}, amount_cents = ${data.amount_cents},
        day_of_month = ${data.day_of_month}, active = ${data.active}
      where id = ${data.id}
    `;
    return { ok: true };
  });

export const deleteRecurring = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ id: idOf(obj(input).id) }))
  .handler(async ({ context, data }) => {
    await requireOwner(context.userId);
    const sql = await getSql();
    // Past months stay logged; only the repeating bill goes away.
    await sql`delete from expense_recurring where id = ${data.id}`;
    return { ok: true };
  });

/** Log a monthly bill as paid for a given month (YYYY-MM). */
export const logRecurring = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = obj(input);
    const month = text(raw.month, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Pick a month");
    return { id: idOf(raw.id), month };
  })
  .handler(async ({ context, data }) => {
    await requireOwner(context.userId);
    const sql = await getSql();
    const rows = await sql<RecurringRow>`
      select id, category, payee, description, amount_cents, day_of_month, active
      from expense_recurring where id = ${data.id}
    `;
    const bill = rows[0];
    if (!bill) throw new Error("That bill was removed");
    const day = String(num(bill.day_of_month)).padStart(2, "0");
    const done = await sql<{ id: number }>`
      select id from expenses
      where recurring_id = ${data.id} and date_trunc('month', spent_on::timestamp) = ${`${data.month}-01`}::timestamp
    `;
    if (done[0]) return { ok: true, id: num(done[0].id) };
    const made = await sql<{ id: number }>`
      insert into expenses (spent_on, category, payee, description, amount_cents, status, recurring_id, created_by)
      values (${`${data.month}-${day}`}, ${bill.category}, ${bill.payee}, ${bill.description}, ${num(bill.amount_cents)},
              'paid', ${data.id}, ${context.userId})
      returning id
    `;
    return { ok: true, id: num(made[0]?.id) };
  });
