export const SECTIONS = [
  "home",
  "calendar",
  "classes",
  "attendance",
  "board",
  "events",
  "film",
  "standings",
  "cleaning",
  "instructors",
  "roster",
  "gear",
  "desk",
] as const;

export type Section = (typeof SECTIONS)[number];

export function isStaff(role: string): boolean {
  return role === "instructor" || role === "owner";
}

export const BELTS = [
  "White",
  "Yellow",
  "Orange",
  "Green",
  "Blue",
  "Purple",
  "Brown",
  "Red",
  "Black",
] as const;

export const DISCIPLINES = ["Forms", "Weapons", "Sparring"] as const;
export const RATINGS = ["AAA", "AA", "A"] as const;

const POINTS: Record<string, number[]> = {
  AAA: [100, 80, 60, 40],
  AA: [75, 60, 45, 30],
  A: [50, 40, 30, 20],
};

export function pointsFor(rating: string, place: number): number {
  return POINTS[rating]?.[place - 1] ?? 0;
}

export type MedalKind = "gold" | "silver" | "bronze";

export function medalFor(place: number): MedalKind | null {
  if (place === 1) return "gold";
  if (place === 2) return "silver";
  if (place === 3) return "bronze";
  return null;
}

export function countMedals(places: number[]): Record<MedalKind, number> {
  const tally: Record<MedalKind, number> = { gold: 0, silver: 0, bronze: 0 };
  for (const place of places) {
    const medal = medalFor(place);
    if (medal) tally[medal] += 1;
  }
  return tally;
}

export function isSection(value: string): value is Section {
  return (SECTIONS as readonly string[]).includes(value);
}

export function clock(value: string): string {
  const [hRaw, mRaw] = value.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function localDateISO(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return localDateISO(new Date(y, (m || 1) - 1, (d || 1) + days));
}

/**
 * The cleaning week that covers today (started on or before today, less than
 * 7 days ago). Falls back to the next upcoming week, then the last one listed.
 */
export function currentWeek<T extends { week_start: string }>(weeks: T[], today = localDateISO()): T | null {
  const sorted = [...weeks].sort((a, b) => a.week_start.localeCompare(b.week_start));
  const running = sorted.filter((week) => week.week_start <= today && today < addDaysISO(week.week_start, 7)).at(-1);
  return running ?? sorted.find((week) => week.week_start > today) ?? sorted.at(-1) ?? null;
}

export function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const CIRCUIT_EVENTS = ["Forms", "Weapons", "Point Fighting"] as const;
export const CIRCUIT_SKILLS = ["NOV", "INT", "ADV"] as const;
export const CIRCUIT_STYLES = ["TRAD", "OPEN"] as const;

export const SKILL_LABEL: Record<(typeof CIRCUIT_SKILLS)[number], string> = {
  NOV: "Novice",
  INT: "Intermediate",
  ADV: "Advanced",
};
export const STYLE_LABEL: Record<(typeof CIRCUIT_STYLES)[number], string> = {
  TRAD: "Traditional",
  OPEN: "Open",
};

export const MSKC_DOCS = [
  { label: "Division chart", href: "http://mskctour.com/Rules.aspx" },
  {
    label: "Kata and weapons",
    href: "http://mskctour.com/Forms/MSKC%20Kata%20and%20Weapons%20Rules%20and%20Divisions%20R2.pdf",
  },
  { label: "Point fighting", href: "http://mskctour.com/Forms/MSKC-point-sparring-rules2025.pdf" },
  { label: "Scoring areas", href: "http://mskctour.com/Forms/SZ.pdf" },
  { label: "Light contact", href: "http://mskctour.com/Forms/Continuous-sparring-rules-MSKC-2019.pdf" },
] as const;

export type CircuitProfile = {
  belt: string;
  age: number | null;
  gender: string;
  skill: string;
  style: string;
  events: string;
  weight_class: string;
};

export type CircuitLine = { event: string; division: string; note: string };

export function parseEvents(value: string): string[] {
  const picked = new Set(
    value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );
  return CIRCUIT_EVENTS.filter((event) => picked.has(event));
}

function side(gender: string, age: number): "Girls" | "Boys" | "Women" | "Men" | "" {
  if (gender !== "girl" && gender !== "boy") return "";
  if (age >= 16) return gender === "girl" ? "Women" : "Men";
  return gender === "girl" ? "Girls" : "Boys";
}

function missing(event: string, note: string): CircuitLine {
  return { event, division: "", note };
}

function placed(event: string, division: string, note = ""): CircuitLine {
  return { event, division, note };
}

function underbeltForms(age: number, skill: string): CircuitLine {
  const event = "Forms";
  if (age <= 5) return placed(event, "5 and under");
  if (age === 6) {
    if (skill === "INT") return missing(event, "Forms at age 6 is novice or advanced only.");
    if (skill !== "NOV" && skill !== "ADV") return missing(event, "Pick novice or advanced.");
    return placed(event, `6 ${skill}`);
  }
  const label = age <= 8 ? "7–8" : age <= 10 ? "9–10" : age <= 12 ? "11–12" : age <= 15 ? "13–15" : age >= 35 ? "35+" : "16+";
  const allowed = age >= 16 ? ["NOV", "ADV"] : ["NOV", "INT", "ADV"];
  if (!allowed.includes(skill)) {
    return missing(event, age >= 16 ? "This age is novice or advanced only." : "Pick novice, intermediate, or advanced.");
  }
  return placed(event, `${label} ${skill}`);
}

function underbeltWeapons(age: number, skill: string): CircuitLine {
  const event = "Weapons";
  if (skill === "INT") return missing(event, "Weapons is novice or advanced only.");
  if (skill !== "NOV" && skill !== "ADV") return missing(event, "Pick novice or advanced.");
  const label = age <= 8 ? "8 and under" : age <= 10 ? "9–10" : age <= 12 ? "11–12" : age <= 15 ? "13–15" : age >= 35 ? "35+" : "16+";
  return placed(event, `${label} ${skill}`);
}

function underbeltFighting(age: number, skill: string, gender: string): CircuitLine {
  const event = "Point Fighting";
  if (age <= 5) return placed(event, "5 and under Girls/Boys");
  if (age === 6) {
    if (skill !== "NOV") return missing(event, "Age 6 point fighting is novice only, girls and boys together.");
    return placed(event, "6 NOV Girls/Boys");
  }
  const who = side(gender, age);
  if (!who) return missing(event, "Pick girl or boy.");
  const label = age <= 8 ? "7–8" : age <= 10 ? "9–10" : age <= 12 ? "11–12" : age <= 15 ? "13–15" : age >= 35 ? "35+" : "16+";
  const allowed = age >= 16 ? ["NOV", "ADV"] : ["NOV", "INT", "ADV"];
  if (!allowed.includes(skill)) {
    return missing(event, age >= 16 ? "16 and up is novice or advanced only." : "Pick novice, intermediate, or advanced.");
  }
  if (age >= 35 && gender === "boy" && skill === "ADV") {
    return missing(event, "The chart lists 35+ novice men, not advanced.");
  }
  const note = age >= 11 && age <= 12 && gender === "boy" ? "The rules page repeats 11–12 Girls. Boys are kept here so they are not dropped." : "";
  return placed(event, `${label} ${skill} ${who}`, note);
}

function blackbeltForms(age: number, style: string, gender: string, event: string): CircuitLine {
  if (style !== "TRAD" && style !== "OPEN") return missing(event, "Pick traditional or open.");
  if (age >= 35) return placed(event, "35 and up OPEN/TRAD");
  if (age >= 16) {
    const who = side(gender, age);
    if (!who) return missing(event, "Pick girl or boy.");
    return placed(event, `16+ ${style} ${who}`);
  }
  const label = age <= 10 ? "10 and under" : age <= 12 ? "11–12" : "13–15";
  return placed(event, `${label} ${style}`);
}

function blackbeltFighting(age: number, gender: string, weight: string): CircuitLine {
  const event = "Point Fighting";
  const who = side(gender, age);
  if (!who) return missing(event, "Pick girl or boy.");
  if (age >= 35) return placed(event, `35+ ${who}`);
  if (age >= 17) {
    if (gender === "girl") return placed(event, "17+ Women");
    if (weight !== "light" && weight !== "heavy") return missing(event, "17+ men split at 175 lb. Pick light or heavy.");
    return placed(event, weight === "light" ? "17+ Men light (−175)" : "17+ Men heavy (+175)");
  }
  const label = age <= 10 ? "10 and under" : age <= 12 ? "11–12" : age <= 14 ? "13–14" : "15–16";
  const note = age >= 11 && age <= 12 && gender === "boy" ? "The rules page repeats 11–12 Girls. Boys are kept here so they are not dropped." : "";
  return placed(event, `${label} ${who}`, note);
}

export function circuitDivisions(profile: CircuitProfile): CircuitLine[] {
  const events = parseEvents(profile.events);
  if (!events.length) return [];
  if (profile.age == null) {
    return events.map((event) => missing(event, "Add an age to place this division."));
  }
  const age = profile.age;
  const black = profile.belt === "Black";
  return events.map((event) => {
    if (black) {
      if (event === "Point Fighting") return blackbeltFighting(age, profile.gender, profile.weight_class);
      return blackbeltForms(age, profile.style, profile.gender, event);
    }
    if (event === "Forms") return underbeltForms(age, profile.skill);
    if (event === "Weapons") return underbeltWeapons(age, profile.skill);
    return underbeltFighting(age, profile.skill, profile.gender);
  });
}

