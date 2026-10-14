import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Download, Paperclip, Pencil, Plus, Repeat, Trash2, X } from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Boot, errText } from "@/components/boot";
import {
  EXPENSE_CATEGORIES,
  amountInput,
  money,
  monthLabel,
  monthOf,
  shiftMonthKey,
  toCsv,
} from "@/lib/books";
import {
  deleteExpense,
  deleteProject,
  deleteRecurring,
  getBooks,
  logRecurring,
  markExpensePaid,
  saveExpense,
  saveProject,
  saveRecurring,
  type BooksData,
  type ExpenseRow,
  type ProjectRow,
  type RecurringRow,
} from "@/lib/books-api";

const field =
  "w-full rounded-lg border border-line bg-ink px-3 py-3 text-base text-paper outline-none focus:border-blue";
const label = "mb-1 block text-xs tracking-[0.14em] text-mute uppercase";
const ghost = "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-3 text-sm";
const primary = "inline-flex min-h-11 items-center gap-2 rounded-full bg-blue px-4 text-sm font-semibold text-ink";

function thisMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function sum(rows: ExpenseRow[]): number {
  return rows.reduce((total, row) => total + row.amount_cents, 0);
}

function useBooksSave<T>(fn: (input: T) => Promise<unknown>, onDone?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["books"] });
      onDone?.();
    },
  });
}

/** Receipt photos are shrunk in the browser to a readable JPEG. */
async function receiptPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("Could not read that photo. Use a JPG or PNG.");
  });
  try {
    let max = 1600;
    let quality = 0.72;
    for (;;) {
      const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not read that photo");
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL("image/jpeg", quality);
      if (url.length < 850_000 || max <= 800) return url;
      max = Math.round(max * 0.8);
      quality = Math.max(0.55, quality - 0.08);
    }
  } finally {
    bitmap.close();
  }
}

export function Books() {
  const [month, setMonth] = useState(thisMonth);
  const year = Number(month.slice(0, 4));
  const query = useQuery({ queryKey: ["books", year], queryFn: () => getBooks({ data: { year } }) });
  const [editing, setEditing] = useState<ExpenseRow | "new" | null>(null);
  const [project, setProject] = useState<ProjectRow | "new" | null>(null);
  const [bill, setBill] = useState<RecurringRow | null>(null);

  if (query.isLoading) return <Boot label="Opening the books" />;
  if (query.isError) return <p className="text-gold">{errText(query.error)}</p>;
  const data = query.data as BooksData;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs tracking-[0.16em] text-gold uppercase">Owner only</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-5xl leading-none tracking-wide">Books</h1>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primary} onClick={() => setEditing("new")}>
              <Plus className="size-4" /> Add expense
            </button>
            <ExportButton data={data} />
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-mute">
          Track what the dojo spends: rent, instructor pay, equipment, and bigger projects. Only you can see this page.
        </p>
      </div>

      <MonthBar month={month} onChange={setMonth} />
      <Totals data={data} month={month} />
      <DueThisMonth data={data} month={month} onEdit={setBill} />
      <MonthExpenses data={data} month={month} onEdit={setEditing} />
      <Projects data={data} onEdit={setProject} />
      <Breakdown data={data} />
      <Bills data={data} onEdit={setBill} />

      <ExpenseSheet
        key={editing === "new" ? "new" : editing?.id ?? "none"}
        open={editing !== null}
        existing={editing === "new" ? null : editing}
        projects={data.projects}
        defaultDate={month === thisMonth() ? today() : `${month}-01`}
        onClose={() => setEditing(null)}
      />
      <ProjectSheet
        key={project === "new" ? "new-project" : project?.id ?? "no-project"}
        open={project !== null}
        existing={project === "new" ? null : project}
        onClose={() => setProject(null)}
      />
      <BillSheet key={bill?.id ?? "no-bill"} bill={bill} onClose={() => setBill(null)} />
    </div>
  );
}

function MonthBar({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-panel px-3 py-2">
      <button type="button" className={ghost} onClick={() => onChange(shiftMonthKey(month, -1))}>
        Previous
      </button>
      <div className="text-center">
        <p className="font-semibold">{monthLabel(month)}</p>
        {month !== thisMonth() ? (
          <button type="button" className="text-xs text-gold" onClick={() => onChange(thisMonth())}>
            Back to this month
          </button>
        ) : null}
      </div>
      <button type="button" className={ghost} onClick={() => onChange(shiftMonthKey(month, 1))}>
        Next
      </button>
    </div>
  );
}

function Tile({ kicker, value, note }: { kicker: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel px-4 py-4">
      <p className="text-xs tracking-[0.16em] text-gold uppercase">{kicker}</p>
      <p className="mt-1 font-display text-3xl tracking-wide tabular-nums">{value}</p>
      {note ? <p className="text-sm text-mute">{note}</p> : null}
    </div>
  );
}

function Totals({ data, month }: { data: BooksData; month: string }) {
  const inMonth = data.expenses.filter((row) => monthOf(row.spent_on) === month);
  const paid = sum(inMonth.filter((row) => row.status === "paid"));
  const planned = sum(inMonth.filter((row) => row.status === "planned"));
  const yearPaid = sum(data.expenses.filter((row) => row.status === "paid" && row.spent_on <= `${month}-31`));
  const monthly = data.recurring.filter((row) => row.active).reduce((total, row) => total + row.amount_cents, 0);
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile kicker={`Spent in ${monthLabel(month).split(" ")[0]}`} value={money(paid)} note={`${inMonth.filter((r) => r.status === "paid").length} paid`} />
      <Tile kicker="Planned" value={money(planned)} note="Not paid yet this month" />
      <Tile kicker={`Year to date ${data.year}`} value={money(yearPaid)} note={`Through ${monthLabel(month).split(" ")[0]}`} />
      <Tile kicker="Monthly bills" value={money(monthly)} note="Every month" />
    </section>
  );
}

function DueThisMonth({ data, month, onEdit }: { data: BooksData; month: string; onEdit: (bill: RecurringRow) => void }) {
  const active = data.recurring.filter((row) => row.active);
  const save = useBooksSave((id: number) => logRecurring({ data: { id, month } }));
  if (!active.length) return null;
  const logged = (bill: RecurringRow) =>
    data.expenses.some((row) => row.recurring_id === bill.id && monthOf(row.spent_on) === month);
  const open = active.filter((bill) => !logged(bill));
  return (
    <section>
      <h2 className="mb-1 font-display text-3xl tracking-wide">Monthly bills for {monthLabel(month).split(" ")[0]}</h2>
      <p className="mb-3 text-sm text-mute">
        {open.length ? `${open.length} not logged yet. Tap Log as paid once it goes out.` : "All logged for this month."}
      </p>
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {active.map((bill) => {
          const done = logged(bill);
          return (
            <li key={bill.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <span>
                <span className="block font-semibold">{bill.payee || bill.category}</span>
                <span className="text-mute">
                  {bill.category} · due the {ordinal(bill.day_of_month)}
                  {bill.description ? ` · ${bill.description}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="tabular-nums">{money(bill.amount_cents)}</span>
                {done ? (
                  <span className="inline-flex min-h-11 items-center gap-1 px-2 text-blue">
                    <CircleCheck className="size-4" /> Logged
                  </span>
                ) : (
                  <button type="button" disabled={save.isPending} className={primary} onClick={() => save.mutate(bill.id)}>
                    Log as paid
                  </button>
                )}
                <button type="button" aria-label={`Edit ${bill.payee || bill.category}`} className="grid size-11 place-items-center text-mute" onClick={() => onEdit(bill)}>
                  <Pencil className="size-4" />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      {save.isError ? <p className="mt-2 text-sm text-gold">{errText(save.error)}</p> : null}
    </section>
  );
}

function ordinal(day: number): string {
  const tail = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
  return `${day}${tail}`;
}

function MonthExpenses({ data, month, onEdit }: { data: BooksData; month: string; onEdit: (row: ExpenseRow) => void }) {
  const rows = data.expenses.filter((row) => monthOf(row.spent_on) === month);
  const paid = useBooksSave((id: number) => markExpensePaid({ data: { id } }));
  const projectName = (id: number | null) => data.projects.find((p) => p.id === id)?.name ?? "";
  return (
    <section>
      <h2 className="mb-3 font-display text-3xl tracking-wide">Expenses in {monthLabel(month).split(" ")[0]}</h2>
      {rows.length ? (
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {row.payee || row.category}
                  {row.status === "planned" ? (
                    <span className="ml-2 rounded-full border border-gold/60 px-2 py-0.5 text-xs font-normal text-gold">Planned</span>
                  ) : null}
                  {row.recurring_id ? <Repeat className="ml-2 inline size-3.5 text-mute" aria-label="Monthly bill" /> : null}
                </span>
                <span className="text-mute">
                  {shortDate(row.spent_on)} · {row.category}
                  {row.project_id ? ` · ${projectName(row.project_id)}` : ""}
                  {row.description ? ` · ${row.description}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <span className="mr-1 font-semibold tabular-nums">{money(row.amount_cents)}</span>
                {row.has_receipt ? (
                  <a
                    href={`/api/expense-receipt/${row.id}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open receipt"
                    className="grid size-11 place-items-center text-mute"
                  >
                    <Paperclip className="size-4" />
                  </a>
                ) : null}
                {row.status === "planned" ? (
                  <button type="button" disabled={paid.isPending} className={ghost} onClick={() => paid.mutate(row.id)}>
                    Mark paid
                  </button>
                ) : null}
                <button type="button" aria-label="Edit expense" className="grid size-11 place-items-center text-mute" onClick={() => onEdit(row)}>
                  <Pencil className="size-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-line px-4 py-4 text-sm text-mute">Nothing logged for this month yet.</p>
      )}
    </section>
  );
}

function Projects({ data, onEdit }: { data: BooksData; onEdit: (row: ProjectRow | "new") => void }) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl tracking-wide">Projects</h2>
          <p className="text-sm text-mute">Bigger one-time spending, like an expansion or new mats, with a budget.</p>
        </div>
        <button type="button" className={ghost} onClick={() => onEdit("new")}>
          <Plus className="size-4" /> New project
        </button>
      </div>
      {data.projects.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.projects.map((project) => {
            const committed = project.spent_cents + project.planned_cents;
            const left = project.budget_cents - committed;
            const pct = project.budget_cents ? Math.min(100, Math.round((project.spent_cents / project.budget_cents) * 100)) : 0;
            const plannedPct = project.budget_cents
              ? Math.min(100 - pct, Math.round((project.planned_cents / project.budget_cents) * 100))
              : 0;
            const over = project.budget_cents > 0 && committed > project.budget_cents;
            return (
              <article key={project.id} className={"rounded-2xl border border-line bg-panel px-4 py-4 " + (project.status === "done" ? "opacity-70" : "")}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xl">{project.name}</h3>
                    <p className="text-sm text-mute">
                      {project.status === "done" ? "Finished" : project.target_date ? `Target ${shortDate(project.target_date)}` : "Active"}
                    </p>
                  </div>
                  <button type="button" aria-label={`Edit ${project.name}`} className="grid size-11 place-items-center text-mute" onClick={() => onEdit(project)}>
                    <Pencil className="size-4" />
                  </button>
                </div>
                {project.budget_cents ? (
                  <div className="mt-3">
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-panel-2" role="img" aria-label={`${pct}% of budget spent`}>
                      <span className={over ? "bg-gold" : "bg-blue"} style={{ width: `${pct}%` }} />
                      <span className="bg-blue/40" style={{ width: `${plannedPct}%` }} />
                    </div>
                    <p className="mt-2 text-sm tabular-nums">
                      {money(project.spent_cents)} spent of {money(project.budget_cents)}
                    </p>
                    <p className={"text-sm tabular-nums " + (over ? "text-gold" : "text-mute")}>
                      {project.planned_cents ? `${money(project.planned_cents)} planned · ` : ""}
                      {over ? `${money(-left)} over budget` : `${money(left)} left`}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm tabular-nums">{money(project.spent_cents)} spent · no budget set</p>
                )}
                {project.notes ? <p className="mt-2 text-sm text-mute">{project.notes}</p> : null}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="rounded-2xl border border-line px-4 py-4 text-sm text-mute">
          No projects yet. Add one for something like a mat replacement or an expansion, then tag its expenses.
        </p>
      )}
    </section>
  );
}

function Breakdown({ data }: { data: BooksData }) {
  const totals = useMemo(() => {
    const map = new Map<string, number>();
    const now = today();
    for (const row of data.expenses) {
      // Paid and dated today or earlier; bills logged ahead count once their date arrives.
      if (row.status !== "paid" || row.spent_on > now) continue;
      map.set(row.category, (map.get(row.category) ?? 0) + row.amount_cents);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [data.expenses]);
  const total = totals.reduce((acc, [, cents]) => acc + cents, 0);
  if (!total) return null;
  const top = totals[0][1];
  return (
    <section>
      <h2 className="mb-1 font-display text-3xl tracking-wide">Where it went in {data.year}</h2>
      <p className="mb-3 text-sm text-mute tabular-nums">{money(total)} paid so far this year</p>
      <ul className="space-y-3 rounded-2xl border border-line px-4 py-4">
        {totals.map(([name, cents]) => (
          <li key={name}>
            <div className="flex justify-between gap-3 text-sm">
              <span>{name}</span>
              <span className="tabular-nums">
                {money(cents)} <span className="text-mute">· {Math.round((cents / total) * 100)}%</span>
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-panel-2">
              <div className="h-2 rounded-full bg-blue" style={{ width: `${Math.max(2, Math.round((cents / top) * 100))}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Bills({ data, onEdit }: { data: BooksData; onEdit: (bill: RecurringRow) => void }) {
  if (!data.recurring.length) {
    return (
      <section>
        <h2 className="mb-1 font-display text-3xl tracking-wide">Monthly bills</h2>
        <p className="rounded-2xl border border-line px-4 py-4 text-sm text-mute">
          Rent, instructor pay, and other repeating costs: add the expense once and check Repeat every month. It then shows up
          each month ready to log with one tap.
        </p>
      </section>
    );
  }
  return (
    <section>
      <h2 className="mb-3 font-display text-3xl tracking-wide">Monthly bills</h2>
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {data.recurring.map((bill) => (
          <li key={bill.id} className={"flex items-center justify-between gap-3 px-4 py-3 text-sm " + (bill.active ? "" : "opacity-60")}>
            <span>
              <span className="block font-semibold">{bill.payee || bill.category}</span>
              <span className="text-mute">
                {bill.category} · the {ordinal(bill.day_of_month)} of each month{bill.active ? "" : " · paused"}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <span className="tabular-nums">{money(bill.amount_cents)}</span>
              <button type="button" aria-label={`Edit ${bill.payee || bill.category}`} className="grid size-11 place-items-center text-mute" onClick={() => onEdit(bill)}>
                <Pencil className="size-4" />
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ExportButton({ data }: { data: BooksData }) {
  function download() {
    const projectName = (id: number | null) => data.projects.find((p) => p.id === id)?.name ?? "";
    const rows: (string | number)[][] = [["Date", "Category", "Paid to", "Description", "Project", "Status", "Amount"]];
    for (const row of [...data.expenses].sort((a, b) => a.spent_on.localeCompare(b.spent_on))) {
      rows.push([
        row.spent_on,
        row.category,
        row.payee,
        row.description,
        projectName(row.project_id),
        row.status === "paid" ? "Paid" : "Planned",
        amountInput(row.amount_cents),
      ]);
    }
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `blue-jaguars-expenses-${data.year}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <button type="button" className={ghost} onClick={download} disabled={!data.expenses.length}>
      <Download className="size-4" /> Export {data.year}
    </button>
  );
}

function Sheet({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/80" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-2xl border border-line bg-panel p-5 text-paper sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-4xl leading-none tracking-wide">{title}</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-mute">{description}</Dialog.Description>
            </div>
            <Dialog.Close className="grid size-11 place-items-center rounded-lg border border-line" aria-label="Close">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Input({
  name,
  value,
  onChange,
  type = "text",
  inputMode,
  placeholder,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: "decimal" | "numeric";
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className={label}>{name}</span>
      <input
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={field}
      />
    </label>
  );
}

function CategorySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className={label}>Category *</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={field}>
        {EXPENSE_CATEGORIES.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function SaveRow({ pending, error, children }: { pending: boolean; error: string; children?: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-blue px-5 font-semibold text-ink disabled:opacity-60">
          {pending ? "Saving…" : "Save"}
        </button>
        {children}
      </div>
      {error ? <p className="text-sm text-gold">{error}</p> : null}
    </div>
  );
}

function DeleteButton({ label: text, run }: { label: string; run: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center gap-1 text-sm text-mute"
      onClick={() => (armed ? run() : setArmed(true))}
    >
      <Trash2 className="size-3.5" /> {armed ? "Tap again to delete" : text}
    </button>
  );
}

function ExpenseSheet({
  open,
  existing,
  projects,
  defaultDate,
  onClose,
}: {
  open: boolean;
  existing: ExpenseRow | null;
  projects: ProjectRow[];
  defaultDate: string;
  onClose: () => void;
}) {
  const [form, setForm] = useState(() => ({
    spent_on: existing?.spent_on ?? defaultDate,
    amount: existing ? amountInput(existing.amount_cents) : "",
    category: existing?.category ?? "Equipment",
    payee: existing?.payee ?? "",
    description: existing?.description ?? "",
    status: existing?.status ?? "paid",
    project_id: existing?.project_id ? String(existing.project_id) : "",
    repeat_monthly: false,
  }));
  const [receipt, setReceipt] = useState<string | undefined>(undefined);
  const [receiptError, setReceiptError] = useState("");
  const save = useBooksSave(
    () => saveExpense({ data: { id: existing?.id ?? null, ...form, receipt } }),
    onClose,
  );
  const remove = useBooksSave(() => deleteExpense({ data: { id: existing?.id } }), onClose);
  const activeProjects = projects.filter((p) => p.status === "active" || p.id === existing?.project_id);
  const hasReceipt = receipt !== undefined ? Boolean(receipt) : Boolean(existing?.has_receipt);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={existing ? "Edit expense" : "Add expense"}
      description="Amount, what it was for, and who was paid. Snap the receipt if you have one."
    >
      <form
        className="grid gap-3"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          save.mutate(undefined);
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Input name="Amount *" value={form.amount} inputMode="decimal" placeholder="0.00" onChange={(amount) => setForm({ ...form, amount })} />
          <Input name="Date *" type="date" value={form.spent_on} onChange={(spent_on) => setForm({ ...form, spent_on })} />
        </div>
        <CategorySelect value={form.category} onChange={(category) => setForm({ ...form, category })} />
        <Input name="Paid to" value={form.payee} placeholder="Landlord, instructor, store" onChange={(payee) => setForm({ ...form, payee })} />
        <Input name="What for" value={form.description} placeholder="October rent, 4 new kick shields" onChange={(description) => setForm({ ...form, description })} />
        <div>
          <span className={label}>Status</span>
          <div className="flex gap-2">
            {(["paid", "planned"] as const).map((status) => (
              <button
                key={status}
                type="button"
                aria-pressed={form.status === status}
                onClick={() => setForm({ ...form, status })}
                className={"min-h-11 flex-1 rounded-full text-sm " + (form.status === status ? "bg-blue font-semibold text-ink" : "border border-line text-mute")}
              >
                {status === "paid" ? "Paid" : "Planned, not paid yet"}
              </button>
            ))}
          </div>
        </div>
        {activeProjects.length ? (
          <label className="block">
            <span className={label}>Project</span>
            <select value={form.project_id} onChange={(event) => setForm({ ...form, project_id: event.target.value })} className={field}>
              <option value="">None</option>
              {activeProjects.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {!existing ? (
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.repeat_monthly}
              onChange={(event) => setForm({ ...form, repeat_monthly: event.target.checked })}
              className="size-5 accent-blue"
            />
            Repeat every month (rent, instructor pay)
          </label>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <label className={ghost + " cursor-pointer"}>
            <Paperclip className="size-4" /> {hasReceipt ? "Replace receipt" : "Add receipt photo"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                setReceiptError("");
                try {
                  setReceipt(await receiptPhoto(file));
                } catch (error) {
                  setReceiptError(errText(error));
                }
              }}
            />
          </label>
          {hasReceipt ? (
            <>
              <span className="text-sm text-mute">{receipt ? "New receipt ready" : "Receipt saved"}</span>
              <button type="button" className="min-h-11 px-2 text-sm text-mute" onClick={() => setReceipt("")}>
                Remove
              </button>
            </>
          ) : null}
        </div>
        {receiptError ? <p className="text-sm text-gold">{receiptError}</p> : null}
        <SaveRow pending={save.isPending} error={save.isError ? errText(save.error) : remove.isError ? errText(remove.error) : ""}>
          {existing ? <DeleteButton label="Delete expense" run={() => remove.mutate(undefined)} /> : null}
        </SaveRow>
      </form>
    </Sheet>
  );
}

function ProjectSheet({ open, existing, onClose }: { open: boolean; existing: ProjectRow | null; onClose: () => void }) {
  const [form, setForm] = useState(() => ({
    name: existing?.name ?? "",
    budget: existing?.budget_cents ? amountInput(existing.budget_cents) : "",
    target_date: existing?.target_date ?? "",
    status: existing?.status ?? "active",
    notes: existing?.notes ?? "",
  }));
  const save = useBooksSave(() => saveProject({ data: { id: existing?.id ?? null, ...form } }), onClose);
  const remove = useBooksSave(() => deleteProject({ data: { id: existing?.id } }), onClose);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={existing ? "Edit project" : "New project"}
      description="Set a budget, then tag expenses to this project to see what's left."
    >
      <form
        className="grid gap-3"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          save.mutate(undefined);
        }}
      >
        <Input name="Project name *" value={form.name} placeholder="Second mat room" onChange={(name) => setForm({ ...form, name })} />
        <div className="grid grid-cols-2 gap-3">
          <Input name="Budget" value={form.budget} inputMode="decimal" placeholder="0.00" onChange={(budget) => setForm({ ...form, budget })} />
          <Input name="Target date" type="date" value={form.target_date} onChange={(target_date) => setForm({ ...form, target_date })} />
        </div>
        <Input name="Notes" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} />
        {existing ? (
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.status === "done"}
              onChange={(event) => setForm({ ...form, status: event.target.checked ? "done" : "active" })}
              className="size-5 accent-blue"
            />
            Project is finished
          </label>
        ) : null}
        <SaveRow pending={save.isPending} error={save.isError ? errText(save.error) : remove.isError ? errText(remove.error) : ""}>
          {existing ? <DeleteButton label="Delete project" run={() => remove.mutate(undefined)} /> : null}
        </SaveRow>
        {existing ? <p className="text-xs text-mute">Deleting a project keeps its expenses; they just lose the project tag.</p> : null}
      </form>
    </Sheet>
  );
}

function BillSheet({ bill, onClose }: { bill: RecurringRow | null; onClose: () => void }) {
  const [form, setForm] = useState(() => ({
    category: bill?.category ?? "Rent",
    payee: bill?.payee ?? "",
    description: bill?.description ?? "",
    amount: bill ? amountInput(bill.amount_cents) : "",
    day_of_month: String(bill?.day_of_month ?? 1),
    active: bill?.active ?? true,
  }));
  const save = useBooksSave(() => saveRecurring({ data: { id: bill?.id, ...form } }), onClose);
  const remove = useBooksSave(() => deleteRecurring({ data: { id: bill?.id } }), onClose);
  if (!bill) return null;
  return (
    <Sheet
      open
      onClose={onClose}
      title="Monthly bill"
      description="Changes apply from now on. Months already logged stay as they were."
    >
      <form
        className="grid gap-3"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          save.mutate(undefined);
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Input name="Amount *" value={form.amount} inputMode="decimal" onChange={(amount) => setForm({ ...form, amount })} />
          <label className="block">
            <span className={label}>Day of month</span>
            <select value={form.day_of_month} onChange={(event) => setForm({ ...form, day_of_month: event.target.value })} className={field}>
              {Array.from({ length: 28 }, (_, i) => String(i + 1)).map((day) => (
                <option key={day} value={day}>
                  {ordinal(Number(day))}
                </option>
              ))}
            </select>
          </label>
        </div>
        <CategorySelect value={form.category} onChange={(category) => setForm({ ...form, category })} />
        <Input name="Paid to" value={form.payee} onChange={(payee) => setForm({ ...form, payee })} />
        <Input name="What for" value={form.description} onChange={(description) => setForm({ ...form, description })} />
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={!form.active}
            onChange={(event) => setForm({ ...form, active: !event.target.checked })}
            className="size-5 accent-blue"
          />
          Pause this bill
        </label>
        <SaveRow pending={save.isPending} error={save.isError ? errText(save.error) : remove.isError ? errText(remove.error) : ""}>
          <DeleteButton label="Stop this bill" run={() => remove.mutate(undefined)} />
        </SaveRow>
      </form>
    </Sheet>
  );
}
