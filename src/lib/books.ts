/** Shared Books helpers (browser and server). */

export const EXPENSE_CATEGORIES = [
  "Rent",
  "Instructor pay",
  "Equipment",
  "Utilities",
  "Insurance",
  "Tournament fees",
  "Supplies",
  "Maintenance",
  "Marketing",
  "Expansion and projects",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function money(cents: number): string {
  return dollars.format(cents / 100);
}

/** Cents to an editable "1234.50" string. */
export function amountInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  return new Date(year, mon - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function shiftMonthKey(month: string, delta: number): string {
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(year, mon - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function csvCell(value: string | number): string {
  const raw = String(value);
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

export function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}
