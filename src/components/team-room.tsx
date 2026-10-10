import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Clapperboard,
  ExternalLink,
  GraduationCap,
  KeyRound,
  LayoutGrid,
  Medal,
  Menu,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  Settings,
  ShoppingBag,
  Trash2,
  Trophy,
  Users,
  Wifi,
  X,
} from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { UserButton, RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  BELTS,
  CIRCUIT_EVENTS,
  CIRCUIT_SKILLS,
  CIRCUIT_STYLES,
  DISCIPLINES,
  MSKC_DOCS,
  RATINGS,
  SKILL_LABEL,
  STYLE_LABEL,
  WEEKDAYS,
  circuitDivisions,
  clock,
  countMedals,
  currentWeek,
  formatDay,
  isStaff,
  localDateISO,
  medalFor,
  parseEvents,
  pointsFor,
  type MedalKind,
  type Section,
} from "@/lib/dojo";
import {
  clearSample,
  deleteClass,
  deleteCleaning,
  deleteInstructor,
  deleteMessage,
  deleteResult,
  deleteStudent,
  deleteTournament,
  deleteVendor,
  getPortal,
  postMessage,
  removeAccess,
  setAttendance,
  setDues,
  setKey,
  setMemberRole,
  saveUsualWeek,
  toggleCleaning,
  updateSettings,
  updateWifi,
  upsertClass,
  upsertCleaning,
  upsertInstructor,
  upsertResult,
  upsertStudent,
  upsertTournament,
  upsertVendor,
  type ClassSession,
  type CleaningWeek,
  type Instructor,
  type MskcResult,
  type PortalData,
  type Student,
  type Tournament,
  type Vendor,
} from "@/lib/dojo-api";
import { Boot, errText } from "@/components/boot";
import { Gallery, LatestFilm } from "@/components/gallery";

const NAV: { id: Section; label: string; icon: typeof LayoutGrid; staff?: boolean }[] = [
  { id: "home", label: "Floor", icon: LayoutGrid },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "board", label: "Board", icon: MessageSquare },
  { id: "events", label: "Events", icon: Trophy },
  { id: "film", label: "Film", icon: Clapperboard },
  { id: "standings", label: "MSKC", icon: Medal },
  { id: "instructors", label: "Instructors", icon: GraduationCap },
  { id: "roster", label: "Roster", icon: Users },
  { id: "gear", label: "Gear", icon: ShoppingBag },
  { id: "desk", label: "Desk", icon: Settings, staff: true },
];

const field =
  "w-full rounded-lg border border-line bg-ink px-3 py-3 text-base text-paper outline-none focus:border-blue";

function minutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function nextSession(classes: ClassSession[], now = new Date()) {
  if (!classes.length) return null;
  const dow = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const sorted = [...classes].sort(
    (a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time),
  );
  const hit = sorted.find(
    (row) => row.weekday > dow || (row.weekday === dow && minutes(row.start_time) >= nowMin),
  );
  const session = hit ?? sorted[0];
  const wrapped = !hit;
  return { session, wrapped };
}

function standingGroups(results: MskcResult[]) {
  const map = new Map<
    string,
    { division: string; discipline: string; people: Map<string, { points: number; events: number }> }
  >();
  for (const row of results) {
    const key = `${row.division}||${row.discipline}`;
    const group = map.get(key) ?? {
      division: row.division,
      discipline: row.discipline,
      people: new Map(),
    };
    const person = group.people.get(row.student_name) ?? { points: 0, events: 0 };
    person.points += row.points;
    person.events += 1;
    group.people.set(row.student_name, person);
    map.set(key, group);
  }
  return [...map.values()]
    .map((group) => ({
      division: group.division,
      discipline: group.discipline,
      rows: [...group.people.entries()]
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.division.localeCompare(b.division) || a.discipline.localeCompare(b.discipline));
}

function roleLabel(role: string) {
  if (role === "owner") return "Owner";
  if (role === "instructor") return "Admin";
  return "Family";
}

function placeLabel(place: number) {
  return ["", "1st", "2nd", "3rd", "4th"][place] ?? String(place);
}

const BELT_CHIP: Record<string, string> = {
  White: "bg-belt-white text-ink",
  Yellow: "bg-belt-yellow text-ink",
  Orange: "bg-belt-orange text-ink",
  Green: "bg-belt-green text-paper",
  Blue: "bg-belt-blue text-ink",
  Purple: "bg-belt-purple text-paper",
  Brown: "bg-belt-brown text-paper",
  Red: "bg-belt-red text-paper",
  Black: "bg-belt-black text-paper ring-1 ring-line",
};

export function TeamRoom({ section }: { section: Section }) {
  const { user, isPending } = useCurrentUserState();
  const query = useQuery({
    queryKey: ["portal"],
    queryFn: () => getPortal(),
    enabled: Boolean(user),
  });
  const [open, setOpen] = useState(false);

  if (isPending || (user && query.isLoading)) return <Boot label="Opening the team room" />;
  if (!user) return <RedirectToSignIn />;
  if (query.isError) {
    const message = errText(query.error);
    if (/unauthorized/i.test(message)) return <RedirectToSignIn />;
    if (/join the team/i.test(message)) return <Navigate to="/" />;
    return (
      <main className="grid min-h-screen place-items-center bg-ink px-6 text-center text-paper">
        <div>
          <h1 className="font-display text-4xl">The desk didn’t open</h1>
          <p className="mt-2 text-mute">{message}</p>
        </div>
      </main>
    );
  }
  if (!query.data) return <Boot label="Opening the team room" />;

  const data = query.data;
  const items = NAV.filter((item) => !item.staff || isStaff(data.role));

  return (
    <div className="min-h-screen bg-ink text-paper lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden border-r border-line lg:flex lg:flex-col lg:px-4 lg:py-6">
        <Brand />
        <Nav items={items} section={section} onPick={() => setOpen(false)} />
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line bg-ink/90 px-4 py-3 backdrop-blur lg:px-8">
          <button
            type="button"
            className="grid size-11 place-items-center rounded-lg border border-line lg:hidden"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" />
          </button>
          <p className="font-display text-2xl leading-none tracking-wide lg:hidden">BLUE JAGUARS</p>
          <p className="hidden text-sm text-mute lg:block">
            {data.settings.city} · {roleLabel(data.role)}
          </p>
          <div className="ml-auto">
            <UserButton />
          </div>
        </header>
        {open ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button type="button" className="absolute inset-0 bg-ink/80" aria-label="Close menu" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-panel px-4 py-6">
              <div className="mb-4 flex items-center justify-between">
                <Brand />
                <button type="button" className="grid size-11 place-items-center" aria-label="Close menu" onClick={() => setOpen(false)}>
                  <X className="size-5" />
                </button>
              </div>
              <Nav items={items} section={section} onPick={() => setOpen(false)} />
            </div>
          </div>
        ) : null}
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {data.hasSample ? <SampleNote staff={isStaff(data.role)} /> : null}
          {section === "home" ? <Home data={data} /> : null}
          {section === "calendar" || section === "classes" || section === "attendance" || section === "cleaning" ? (
            <Calendar data={data} />
          ) : null}
          {section === "board" ? <Board data={data} /> : null}
          {section === "events" ? <Events data={data} /> : null}
          {section === "film" ? (
            <Gallery staff={isStaff(data.role)} athletes={data.students.map((student) => student.student_name)} />
          ) : null}
          {section === "standings" ? <Standings data={data} /> : null}
          {section === "instructors" ? <Instructors data={data} /> : null}
          {section === "roster" ? <Roster data={data} /> : null}
          {section === "gear" ? <Gear data={data} /> : null}
          {section === "desk" ? <Desk data={data} /> : null}
        </main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <Link to="/app" search={{ section: "home" }} className="mb-6 flex items-center gap-3">
      <img src="/favicon.svg" alt="" className="size-10" />
      <span>
        <span className="block font-display text-2xl leading-none tracking-wide">BLUE JAGUARS</span>
        <span className="text-xs tracking-[0.2em] text-gold">TEAM ROOM</span>
      </span>
    </Link>
  );
}

function Nav({
  items,
  section,
  onPick,
}: {
  items: typeof NAV;
  section: Section;
  onPick: () => void;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
      {items.map((item) => {
        const Icon = item.icon;
        const active =
          item.id === section ||
          (item.id === "calendar" && (section === "classes" || section === "attendance" || section === "cleaning"));
        return (
          <Link
            key={item.id}
            to="/app"
            search={{ section: item.id }}
            aria-current={active ? "page" : undefined}
            onClick={onPick}
            className={
              "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm " +
              (active ? "bg-panel-2 text-paper" : "text-mute hover:bg-panel-2 hover:text-paper")
            }
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SampleNote({ staff }: { staff: boolean }) {
  return (
    <p className="mb-6 rounded-xl border border-gold/40 bg-panel px-4 py-3 text-sm text-paper">
      The athletes, weekly classes, cleaning rotation, point totals, and ring film below are a sample so you can see the shape of the room.
      {staff ? " Clear them from the Desk before you enter the real team." : " Your instructor can replace them."}
    </p>
  );
}

function PageHead({ kicker, title, action }: { kicker: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="font-display text-sm tracking-[0.28em] text-gold">{kicker}</p>
        <h1 className="font-display text-5xl leading-none tracking-wide">{title}</h1>
      </div>
      {action}
    </div>
  );
}

function BlockHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <h2 className="font-display text-3xl tracking-wide">{title}</h2>
      {action}
    </div>
  );
}

function daysUntil(date: string, now = new Date()) {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(year, (month || 1) - 1, day || 1);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86400000);
}

function Calendar({ data }: { data: PortalData }) {
  const today = localDateISO();
  const next = data.tournaments.find((event) => event.event_date >= today) ?? null;
  const days = next ? daysUntil(next.event_date) : null;
  const count = days === null ? "" : days <= 0 ? "Today" : days === 1 ? "1 day" : `${days} days`;
  return (
    <div>
      <PageHead kicker="Class info" title="Calendar" />
      {next ? (
        <Link
          to="/app"
          search={{ section: "events" }}
          className="mb-10 block max-w-xl rounded-2xl border border-line bg-panel px-4 py-4 hover:border-blue"
        >
          <p className="text-xs tracking-[0.16em] text-gold uppercase">Next tournament</p>
          <p className="mt-2 font-display text-6xl leading-none tracking-wide">{count}</p>
          <p className="mt-2 text-lg">{next.name}</p>
          <p className="text-sm text-mute">
            {formatDay(next.event_date)}
            {next.venue || next.presenter ? ` · ${(next.venue || next.presenter).split(",")[0]}` : ""}
          </p>
        </Link>
      ) : (
        <p className="mb-10 text-mute">No tournament on the card yet. Add one from Events.</p>
      )}
      <Classes data={data} embedded />
      <div className="mt-10">
        <Attendance data={data} embedded />
      </div>
      <div className="mt-10">
        <Cleaning data={data} embedded />
      </div>
    </div>
  );
}

function CreedPair({ lead, because }: { lead: string; because: string }) {
  return (
    <div className="mt-3">
      <p className="font-creed text-[1.7rem] leading-none tracking-wide text-[#f3efe4] sm:text-4xl">{lead}</p>
      <p className="mt-0.5 font-creed text-lg leading-none tracking-[0.14em] text-lime sm:text-xl">{because}</p>
    </div>
  );
}

function MottoPoster() {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="inline-flex min-h-11 items-center rounded-lg border border-line bg-panel px-4 text-sm font-semibold text-paper">
        View motto
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75" />
        <Dialog.Content className="creed-poster fixed top-1/2 left-1/2 z-50 max-h-[92vh] w-[min(100%-1.5rem,26rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-sm px-4 py-5 text-center shadow-2xl">
          <Dialog.Title className="sr-only">Dojo motto</Dialog.Title>
          <Dialog.Description className="sr-only">The full Blue Jaguars creed. Close when you are done reading.</Dialog.Description>
          <Dialog.Close className="absolute top-2 right-2 grid size-11 place-items-center text-[#f3efe4]" aria-label="Close">
            <X className="size-5" />
          </Dialog.Close>
          <CreedPair lead="My aim is accurate" because="Because I have trained it" />
          <CreedPair lead="My mind is sharp" because="Because I have honed it" />
          <CreedPair lead="My body is strong" because="Because I have pushed it" />
          <div className="relative mx-auto mt-4 h-56 w-56">
            <p className="absolute top-1/2 left-0 -translate-y-1/2 -rotate-90 font-creed text-2xl tracking-[0.2em] text-[#d5dbe6]">
              Blue
            </p>
            <p className="absolute top-1/2 right-0 -translate-y-1/2 rotate-90 font-creed text-2xl tracking-[0.18em] text-[#d5dbe6]">
              Karate
            </p>
            <svg viewBox="0 0 200 200" className="absolute inset-0" aria-hidden="true">
              <circle cx="100" cy="100" r="78" fill="none" stroke="#7dff3c" strokeWidth="7" />
              <circle cx="100" cy="100" r="68" fill="#071426" />
              <circle cx="100" cy="100" r="68" fill="none" stroke="#12386e" strokeWidth="10" />
              <g fill="none" stroke="#1d4f96" strokeWidth="1">
                <path d="M48 70 L70 48 L92 70 L70 92 Z" />
                <path d="M108 58 L128 40 L148 62 L126 80 Z" />
                <path d="M46 120 L68 104 L90 126 L66 146 Z" />
                <path d="M112 118 L136 108 L154 132 L128 148 Z" />
              </g>
              <g transform="translate(46 48)">
                <path
                  fill="#1f6fe0"
                  d="M18 46c8-22 28-34 48-30 10 2 16 8 22 6 4-2 10 2 12 8 6 2 14 12 12 24-1 8-8 12-8 20 0 10-8 22-22 26-16 4-30-2-40-12-6 6-16 8-22 2-8-8-4-20 2-26-8-6-12-16-8-24 2-2 4 2 4 6z"
                />
                <path fill="#0c3f8c" d="M34 28c6 4 8 12 4 16-6-2-10-8-8-14 1-1 3-2 4-2zM58 22c8 2 12 10 8 16-8-2-14-8-12-14 1-1 3-2 4-2zM78 36c6 6 6 14 0 16-4-6-4-12 0-16z" />
                <path fill="#f2c14e" d="M62 48c4 0 8 4 7 8-4 1-8-2-8-6 0-1 0-2 1-2z" />
                <path fill="#111" d="M66 51c1.4 0 2 1.2 2 2s-.8 2-2 2-2-1-2-2 .8-2 2-2z" />
                <path fill="#f4f7fb" d="M86 62c8 2 14 8 14 8l-6 10-16 2c2-4 4-12 8-20z" />
                <path fill="#111" d="M90 70l8 4-10 6z" />
                <path stroke="#9fd0ff" strokeWidth="1.4" d="M98 74l16 2M100 80l18 6" />
              </g>
            </svg>
            <p className="absolute bottom-9 left-1/2 -translate-x-1/2 font-creed text-xl tracking-wide text-[#3c8dff]">スポーツ空手</p>
          </div>
          <svg viewBox="0 0 280 36" className="mx-auto -mt-2 h-8 w-56" aria-hidden="true">
            <path id="own-arc" d="M16 32 Q140 2 264 32" fill="none" />
            <text fill="#d5dbe6" fontFamily="Bebas Neue, Barlow Condensed, sans-serif" fontSize="18" letterSpacing="4">
              <textPath href="#own-arc" startOffset="50%" textAnchor="middle">
                OWN THE MOMENT
              </textPath>
            </text>
          </svg>
          <CreedPair lead="I have earned my skill" because="With sweat and blood" />
          <div className="mt-3">
            <p className="font-creed text-[1.7rem] leading-none tracking-wide text-[#f3efe4] sm:text-4xl">I am not an athlete</p>
            <p className="mt-1 font-creed text-3xl leading-none tracking-[0.08em] text-lime sm:text-4xl">I am a fighter</p>
          </div>
          <Dialog.Close className="mt-5 inline-flex min-h-11 items-center rounded-full border border-[#f3efe4]/40 px-5 text-sm font-semibold text-[#f3efe4]">
            Close
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Home({ data }: { data: PortalData }) {
  const upcoming = nextSession(data.classes);
  const today = localDateISO();
  const nextEvent = data.tournaments.find((event) => event.event_date >= today) ?? null;
  const cleaning = currentWeek(data.cleaning, today);
  const leaders = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of data.results) totals.set(row.student_name, (totals.get(row.student_name) ?? 0) + row.points);
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [data.results]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-display text-sm tracking-[0.28em] text-gold">{data.settings.city.toUpperCase()}</p>
        <MottoPoster />
      </div>
      {data.settings.motto !== "Own the moment." && data.settings.motto !== "Quiet feet. Sharp hands." ? (
        <p className="mt-2 max-w-3xl font-display text-4xl leading-none tracking-wide sm:text-5xl">{data.settings.motto}</p>
      ) : null}
      <p className="mt-3 max-w-2xl text-mute">{data.settings.about}</p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <section className="min-w-[16rem] max-w-md flex-1 rounded-2xl border border-line bg-panel px-4 py-4">
          <p className="flex items-center gap-2 text-xs tracking-[0.16em] text-gold uppercase">
            <Wifi className="size-4" /> Dojo Wi-Fi
          </p>
          {data.settings.wifi_name ? (
            <>
              <p className="mt-2 text-lg">{data.settings.wifi_name}</p>
              <p className="mt-1 break-all font-mono text-sm text-paper">{data.settings.wifi_password || "No password"}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-mute">An admin can post the network name and password from the Desk.</p>
          )}
        </section>
        {data.settings.dues_url ? (
          <a
            href={data.settings.dues_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center rounded-lg bg-gold px-4 font-semibold text-ink"
          >
            Pay monthly dues
          </a>
        ) : null}
        <Link to="/app" search={{ section: "calendar" }} className="inline-flex min-h-11 items-center text-sm text-gold">
          Mark who is in this week
        </Link>
      </div>
      <div className="mt-8 grid gap-3 md:grid-cols-3">
        <Tile
          kicker="Next class"
          title={upcoming ? upcoming.session.title : "No classes yet"}
          body={
            upcoming
              ? `${upcoming.wrapped ? "Next week · " : ""}${WEEKDAYS[upcoming.session.weekday]} ${clock(upcoming.session.start_time)} · ${upcoming.session.instructor}`
              : "Instructors can add the weekly schedule."
          }
          href="calendar"
        />
        <Tile
          kicker="Next event"
          title={nextEvent ? nextEvent.name : "Nothing on the card"}
          body={
            nextEvent
              ? `${formatDay(nextEvent.event_date)} · ${(nextEvent.venue || nextEvent.presenter).split(",")[0]}`
              : "Add a tournament from Events."
          }
          href="events"
        />
        <Tile
          kicker="Cleaning"
          title={cleaning ? cleaning.family_name : "No rotation yet"}
          body={cleaning ? `Week of ${formatDay(cleaning.week_start)}${cleaning.done ? " · done" : ""}` : "Set the family rotation."}
          href="calendar"
        />
      </div>
      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-3xl tracking-wide">Circuit leaders</h2>
          <Link to="/app" search={{ section: "standings" }} className="text-sm text-gold">
            Full card
          </Link>
        </div>
        {leaders.length ? (
          <ol className="grid gap-3 sm:grid-cols-3">
            {leaders.map(([name, points], index) => (
              <li key={name} className="rounded-2xl border border-line bg-panel px-4 py-4">
                <p className="font-display text-gold">{index + 1}</p>
                <p className="mt-1 text-lg">{name}</p>
                <p className="tabular-nums text-mute">{points} pts</p>
                <MedalTally places={data.results.filter((row) => row.student_name === name).map((row) => row.place)} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-mute">No placements logged yet.</p>
        )}
      </section>
      <LatestFilm />
    </div>
  );
}

function Tile({ kicker, title, body, href }: { kicker: string; title: string; body: string; href: Section }) {
  return (
    <Link to="/app" search={{ section: href }} className="block rounded-2xl border border-line bg-panel px-4 py-4 hover:border-blue">
      <p className="text-xs tracking-[0.18em] text-gold uppercase">{kicker}</p>
      <p className="mt-2 font-display text-3xl leading-none tracking-wide">{title}</p>
      <p className="mt-2 text-sm text-mute">{body}</p>
    </Link>
  );
}

function Classes({ data, embedded = false }: { data: PortalData; embedded?: boolean }) {
  const staff = isStaff(data.role);
  const [day, setDay] = useState(() => {
    const today = new Date().getDay();
    return data.classes.some((row) => row.weekday === today) ? today : 1;
  });
  const rows = data.classes.filter((row) => row.weekday === day);
  const action = staff ? <ClassEditor /> : null;
  return (
    <div>
      {embedded ? <BlockHead title="Classes" action={action} /> : <PageHead kicker="Weekly floor" title="Classes" action={action} />}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {WEEKDAYS.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => setDay(index)}
            className={
              "min-h-11 shrink-0 rounded-full px-4 py-2 text-sm " +
              (day === index ? "bg-blue text-ink" : "border border-line text-mute")
            }
          >
            {label}
          </button>
        ))}
      </div>
      {rows.length ? (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-2xl border border-line bg-panel px-4 py-4 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="font-display text-4xl tabular-nums leading-none">{clock(row.start_time)}</p>
                <p className="mt-1 text-sm text-mute">until {clock(row.end_time)} · {row.room}</p>
              </div>
              <div className="mt-3 sm:mt-0 sm:text-right">
                <p className="text-lg">{row.title}</p>
                <p className="text-sm text-mute">{row.ages} · {row.instructor}</p>
                {row.focus ? <p className="text-sm text-paper/80">{row.focus}</p> : null}
              </div>
              {staff ? (
                <div className="mt-3 sm:ml-4 sm:mt-0">
                  <ClassEditor existing={row} />
                  <Remove id={row.id} label="Remove class" run={(id) => deleteClass({ data: { id } })} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-mute">Nothing on the floor {WEEKDAYS[day]}.</p>
      )}
    </div>
  );
}

function Events({ data }: { data: PortalData }) {
  const staff = isStaff(data.role);
  const today = localDateISO();
  const upcoming = data.tournaments.filter((event) => event.event_date >= today);
  const past = data.tournaments.filter((event) => event.event_date < today).reverse();
  return (
    <div>
      <PageHead kicker="Circuit & extras" title="Events" action={staff ? <EventEditor /> : null} />
      <p className="mb-4 text-sm text-mute">
        Photos and fight video from these weekends are filed in{" "}
        <Link to="/app" search={{ section: "film" }} className="text-gold">
          Film
        </Link>
        .
      </p>
      <EventList title="Coming up" rows={upcoming} staff={staff} results={data.results} empty="No upcoming events. Add one, or check the MSKC calendar." />
      <div className="mt-8">
        <EventList title="Already run" rows={past} staff={staff} results={data.results} empty="No past events on the card." />
      </div>
    </div>
  );
}

function EventList({
  title,
  rows,
  staff,
  results,
  empty,
}: {
  title: string;
  rows: Tournament[];
  staff: boolean;
  results: MskcResult[];
  empty: string;
}) {
  return (
    <section>
      <h2 className="mb-3 font-display text-3xl tracking-wide">{title}</h2>
      {rows.length ? (
        <ul className="space-y-3">
          {rows.map((event) => (
            <li key={event.id} className="rounded-2xl border border-line bg-panel px-4 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-xl">{event.name}</h3>
                <p className="font-display text-2xl text-gold">{formatDay(event.event_date)}</p>
              </div>
              <p className="mt-1 text-sm text-mute">
                {[event.rating ? `${event.rating} rated` : "", event.presenter, event.venue].filter(Boolean).join(" · ")}
              </p>
              {event.notes ? <p className="mt-2 text-sm">{event.notes}</p> : null}
              <EventMedals results={results.filter((row) => row.event_name === event.name)} />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {event.info_url ? (
                  <a href={event.info_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 text-sm text-gold">
                    Event page <ExternalLink className="size-4" />
                  </a>
                ) : null}
                {staff ? (
                  <>
                    <EventEditor existing={event} />
                    <Remove id={event.id} label="Remove event" run={(id) => deleteTournament({ data: { id } })} />
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-mute">{empty}</p>
      )}
    </section>
  );
}

function Standings({ data }: { data: PortalData }) {
  const staff = isStaff(data.role);
  const groups = standingGroups(data.results);
  return (
    <div>
      <PageHead
        kicker="Michigan Sport Karate Circuit"
        title="Standings"
        action={staff ? <ResultEditor students={data.students} tournaments={data.tournaments} /> : null}
      />
      <p className="max-w-2xl text-sm text-mute">
        Points follow the published MSKC scale. A 1st is gold, a 2nd is silver, and a 3rd is bronze. 4th still earns points, but it is not a medal.
      </p>
      <a href="http://www.mskctour.com/Events.aspx" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-gold">
        MSKC events <ExternalLink className="size-4" />
      </a>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
        <table className="w-full text-left text-sm tabular-nums">
          <caption className="sr-only">MSKC points for 1st through 4th by rating</caption>
          <thead className="bg-panel text-mute">
            <tr>
              <th className="px-3 py-2 font-medium">Place</th>
              <th className="px-3 py-2 font-medium">AAA</th>
              <th className="px-3 py-2 font-medium">AA</th>
              <th className="px-3 py-2 font-medium">A</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4].map((place) => (
              <tr key={place} className="border-t border-line">
                <th className="px-3 py-2 font-medium">{placeLabel(place)}</th>
                {RATINGS.map((rating) => (
                  <td key={rating} className="px-3 py-2">{pointsFor(rating, place)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MedalTally places={data.results.map((row) => row.place)} />
      <div className="mt-6 space-y-4">
        {groups.length ? (
          groups.map((group) => {
            const top = group.rows[0]?.points || 1;
            return (
              <section key={`${group.division}-${group.discipline}`} className="rounded-2xl border border-line bg-panel px-4 py-4">
                <h2 className="text-lg">{group.division}</h2>
                <p className="text-sm text-gold">{group.discipline}</p>
                <ol className="mt-3 space-y-2">
                  {group.rows.map((row, index) => (
                    <li key={row.name} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3">
                      <span className="font-display text-xl text-mute">{index + 1}</span>
                      <div>
                        <div className="flex items-baseline justify-between gap-3">
                          <span>{row.name}</span>
                          <span className="tabular-nums text-sm text-mute">{row.points} · {row.events} event{row.events === 1 ? "" : "s"}</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-ink">
                          <div className="h-full rounded-full bg-blue" style={{ width: `${Math.max(8, Math.round((row.points / top) * 100))}%` }} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })
        ) : (
          <p className="text-mute">No results yet. An instructor can log a 1st through 4th.</p>
        )}
      </div>
      {data.results.length ? (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-3xl tracking-wide">Medals by tournament</h2>
          <MedalEvents results={data.results} />
        </section>
      ) : null}
      {data.results.length ? (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-3xl tracking-wide">Placements</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {data.results.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <MedalChip place={row.place} />
                  <span>
                    {row.student_name} · {row.discipline} · {row.event_name}
                  </span>
                </span>
                <span className="flex items-center gap-3 text-mute">
                  <span className="tabular-nums">{row.points} pts · {row.rating}</span>
                  {staff ? <Remove id={row.id} label="Remove placement" run={(id) => deleteResult({ data: { id } })} /> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Cleaning({ data, embedded = false }: { data: PortalData; embedded?: boolean }) {
  const staff = isStaff(data.role);
  const today = localDateISO();
  const currentId = currentWeek(data.cleaning, today)?.id ?? null;
  const save = useSave<{ id: number }>((id) => toggleCleaning({ data: id }));
  const action = staff ? <CleaningEditor /> : null;
  return (
    <div>
      {embedded ? <BlockHead title="Cleaning" action={action} /> : <PageHead kicker="Who has the broom" title="Cleaning" action={action} />}
      <p className="mb-4 max-w-2xl text-sm text-mute">Any signed-in family can mark a week done. Instructors set the rotation.</p>
      {data.cleaning.length ? (
        <ul className="space-y-3">
          {data.cleaning.map((week) => {
            const current = week.id === currentId;
            return (
              <li key={week.id} className={"rounded-2xl border px-4 py-4 " + (current ? "border-gold bg-panel" : "border-line bg-panel")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs tracking-[0.16em] text-gold uppercase">{current ? "This stretch" : "Week of"} {formatDay(week.week_start)}</p>
                    <h2 className="mt-1 text-xl">{week.family_name}</h2>
                    <p className="mt-1 text-sm text-mute">{week.tasks}</p>
                  </div>
                  <button
                    type="button"
                    disabled={save.isPending}
                    onClick={() => save.mutate({ id: week.id })}
                    className={
                      "min-h-11 rounded-full px-4 py-2 text-sm font-semibold " +
                      (week.done ? "bg-gold text-ink" : "border border-line text-paper")
                    }
                  >
                    {week.done ? "Done" : "Mark done"}
                  </button>
                </div>
                {staff ? (
                  <div className="mt-3 flex gap-2">
                    <CleaningEditor existing={week} />
                    <Remove id={week.id} label="Remove week" run={(id) => deleteCleaning({ data: { id } })} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-mute">No cleaning weeks yet.</p>
      )}
      {save.isError ? <p className="mt-3 text-sm text-gold">{errText(save.error)}</p> : null}
    </div>
  );
}

function Instructors({ data }: { data: PortalData }) {
  const staff = isStaff(data.role);
  return (
    <div>
      <PageHead kicker="Who runs the floor" title="Instructors" action={staff ? <InstructorEditor /> : null} />
      {data.instructors.length ? (
        <ul className="grid gap-3 md:grid-cols-3">
          {data.instructors.map((person) => (
            <li key={person.id} className="rounded-2xl border border-line bg-panel px-4 py-4">
              <p className="font-display text-5xl leading-none text-blue">{person.name.slice(0, 1)}</p>
              <h2 className="mt-3 text-xl">{person.name}</h2>
              <p className="text-sm text-gold">{person.rank} · {person.role}</p>
              {person.bio ? <p className="mt-2 text-sm text-mute">{person.bio}</p> : null}
              <div className="mt-3 space-y-1 text-sm">
                {person.phone ? <a className="block text-paper" href={`tel:${person.phone}`}>{person.phone}</a> : null}
                {person.email ? <a className="block break-all text-mute" href={`mailto:${person.email}`}>{person.email}</a> : null}
              </div>
              {staff ? (
                <div className="mt-3 flex gap-2">
                  <InstructorEditor existing={person} />
                  <Remove id={person.id} label="Remove instructor" run={(id) => deleteInstructor({ data: { id } })} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-mute">No instructors listed yet.</p>
      )}
    </div>
  );
}

function Roster({ data }: { data: PortalData }) {
  const staff = isStaff(data.role);
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const rows = data.students.filter((student) => {
    if (!needle) return true;
    return [student.student_name, student.parent_name, student.parent_email, student.parent_phone, student.belt, student.events]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
  return (
    <div>
      <PageHead kicker="Athletes and parents" title="Roster" action={staff ? <StudentEditor /> : null} />
      <p className="mb-3 max-w-2xl text-sm text-mute">
        Each athlete can carry a circuit card: girl or boy, skill, and the events they enter. Division names follow the MSKC chart.
      </p>
      <ul className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {MSKC_DOCS.map((doc) => (
          <li key={doc.href} className="shrink-0">
            <a
              href={doc.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-3 text-sm text-paper"
            >
              {doc.label}
              <ExternalLink className="size-3.5 text-gold" />
            </a>
          </li>
        ))}
      </ul>
      <label className="mb-4 block">
        <span className="sr-only">Search roster</span>
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search a name, belt, or phone"
          className={field}
        />
      </label>
      {rows.length ? (
        <ul className="space-y-3">
          {rows.map((student) => (
            <li key={student.id} className="rounded-2xl border border-line bg-panel px-4 py-4 sm:grid sm:grid-cols-[1fr_1fr_auto] sm:gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl">{student.student_name}</h2>
                  <span className={"rounded-full px-2 py-0.5 text-xs font-semibold " + (BELT_CHIP[student.belt] ?? "bg-panel-2 text-paper")}>
                    {student.belt}
                  </span>
                  {student.age ? <span className="text-sm text-mute">Age {student.age}</span> : null}
                </div>
                {student.notes ? <p className="mt-1 text-sm text-mute">{student.notes}</p> : null}
                <CircuitLines student={student} />
                <MedalShelf results={data.results.filter((row) => row.student_name === student.student_name)} />
              </div>
              <div className="mt-3 text-sm sm:mt-0">
                <p>{student.parent_name}</p>
                {student.parent_phone ? (
                  <a className="mt-1 flex items-center gap-2 text-paper" href={`tel:${student.parent_phone}`}>
                    <Phone className="size-4 text-gold" /> {student.parent_phone}
                  </a>
                ) : null}
                {student.parent_email ? (
                  <a className="mt-1 block break-all text-mute" href={`mailto:${student.parent_email}`}>{student.parent_email}</a>
                ) : null}
              </div>
              {staff ? (
                <div className="mt-3 flex gap-2 sm:mt-0 sm:flex-col">
                  <StudentEditor existing={student} />
                  <Remove id={student.id} label="Remove athlete" run={(id) => deleteStudent({ data: { id } })} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-mute">{data.students.length ? "No one matches that search." : "The roster is empty."}</p>
      )}
    </div>
  );
}

function CircuitLines({ student }: { student: Student }) {
  const lines = circuitDivisions(student);
  if (!student.gender && !lines.length) return null;
  const skill = student.belt === "Black" ? STYLE_LABEL[student.style as keyof typeof STYLE_LABEL] : SKILL_LABEL[student.skill as keyof typeof SKILL_LABEL];
  return (
    <div className="mt-3 space-y-1">
      <p className="text-xs tracking-[0.14em] text-gold uppercase">
        {[student.gender === "girl" ? "Girl" : student.gender === "boy" ? "Boy" : "", skill].filter(Boolean).join(" · ") || "Circuit card"}
      </p>
      {lines.length ? (
        <ul className="space-y-1">
          {lines.map((line) => (
            <li key={line.event} className="text-sm text-paper">
              <span className="text-gold">{line.event}: </span>
              {line.division ? <span>{line.division}</span> : <span>{line.note}</span>}
              {line.division && line.note ? <span className="mt-0.5 block text-mute">{line.note}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-mute">No events picked yet.</p>
      )}
    </div>
  );
}

const MEDAL_CLASS: Record<MedalKind, string> = {
  gold: "bg-gold text-ink",
  silver: "bg-paper text-ink",
  bronze: "bg-belt-brown text-paper",
};

const MEDAL_NAME: Record<MedalKind, string> = {
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
};

function MedalChip({ place }: { place: number }) {
  const medal = medalFor(place);
  if (!medal) return <span className="text-mute">{placeLabel(place)}</span>;
  return <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold " + MEDAL_CLASS[medal]}>{MEDAL_NAME[medal]}</span>;
}

function MedalTally({ places }: { places: number[] }) {
  const tally = countMedals(places);
  if (!tally.gold && !tally.silver && !tally.bronze) return null;
  return (
    <p className="mt-2 flex flex-wrap gap-2">
      {(["gold", "silver", "bronze"] as const).map((kind) => (
        <span key={kind} className={"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold " + MEDAL_CLASS[kind]}>
          {tally[kind]} {MEDAL_NAME[kind]}
        </span>
      ))}
    </p>
  );
}

function MedalShelf({ results }: { results: MskcResult[] }) {
  if (!results.length) return null;
  const medals = results
    .filter((row) => medalFor(row.place))
    .sort((a, b) => b.event_date.localeCompare(a.event_date) || a.place - b.place);
  return (
    <div className="mt-3">
      <p className="text-xs tracking-[0.14em] text-gold uppercase">Medals</p>
      <MedalTally places={results.map((row) => row.place)} />
      {medals.length ? (
        <ul className="mt-2 space-y-1">
          {medals.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-2 text-sm">
              <MedalChip place={row.place} />
              <span>
                {row.discipline} · {row.event_name}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-mute">No medals yet. A 4th still counts for points.</p>
      )}
    </div>
  );
}

function EventMedals({ results }: { results: MskcResult[] }) {
  const medals = results
    .filter((row) => medalFor(row.place))
    .sort((a, b) => a.place - b.place || a.student_name.localeCompare(b.student_name));
  if (!medals.length) return null;
  return (
    <ul className="mt-3 space-y-1">
      {medals.map((row) => (
        <li key={row.id} className="flex flex-wrap items-center gap-2 text-sm">
          <MedalChip place={row.place} />
          <span>
            {row.student_name} · {row.discipline}
          </span>
        </li>
      ))}
    </ul>
  );
}

function MedalEvents({ results }: { results: MskcResult[] }) {
  const groups = new Map<string, MskcResult[]>();
  for (const row of results) {
    if (!medalFor(row.place)) continue;
    const list = groups.get(row.event_name) ?? [];
    list.push(row);
    groups.set(row.event_name, list);
  }
  const cards = [...groups.entries()].sort((a, b) => (b[1][0]?.event_date ?? "").localeCompare(a[1][0]?.event_date ?? ""));
  if (!cards.length) return <p className="text-mute">No medals logged yet.</p>;
  return (
    <div className="space-y-3">
      {cards.map(([name, rows]) => (
        <section key={name} className="rounded-2xl border border-line bg-panel px-4 py-4">
          <h3 className="text-lg">{name}</h3>
          <p className="text-sm text-mute">{formatDay(rows[0].event_date)}</p>
          <ul className="mt-3 space-y-2">
            {[...rows]
              .sort((a, b) => a.place - b.place || a.student_name.localeCompare(b.student_name))
              .map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <MedalChip place={row.place} />
                  <span>
                    {row.student_name} · {row.discipline}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Gear({ data }: { data: PortalData }) {
  const staff = isStaff(data.role);
  const categories = [...new Set(data.vendors.map((vendor) => vendor.category || "Gear"))];
  return (
    <div>
      <PageHead kicker="Order from here" title="Gear" action={staff ? <VendorEditor /> : null} />
      <p className="mb-4 max-w-2xl text-sm text-mute">
        These open the supplier’s own site. Blue Jaguars doesn’t take the order.
      </p>
      {categories.map((category) => (
        <section key={category} className="mb-6">
          <h2 className="mb-3 font-display text-3xl tracking-wide">{category}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.vendors
              .filter((vendor) => (vendor.category || "Gear") === category)
              .map((vendor) => (
                <li key={vendor.id} className="rounded-2xl border border-line bg-panel px-4 py-4">
                  <a href={vendor.url} target="_blank" rel="noreferrer" className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block text-lg">{vendor.name}</span>
                      <span className="mt-1 block text-sm text-mute">{vendor.blurb}</span>
                    </span>
                    <ExternalLink className="mt-1 size-4 shrink-0 text-gold" />
                  </a>
                  {staff ? (
                    <div className="mt-3 flex gap-2">
                      <VendorEditor existing={vendor} />
                      <Remove id={vendor.id} label="Remove link" run={(id) => deleteVendor({ data: { id } })} />
                    </div>
                  ) : null}
                </li>
              ))}
          </ul>
        </section>
      ))}
      {!data.vendors.length ? <p className="text-mute">No gear links yet.</p> : null}
    </div>
  );
}

function weekDates(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  return WEEKDAYS.map((_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return localDateISO(date);
  });
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return monthKey(new Date(year, monthNumber - 1 + delta, 1));
}

function formatStamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function ownsAthlete(email: string, parentEmail: string) {
  const mine = email.trim().toLowerCase();
  const parent = parentEmail.trim().toLowerCase();
  return Boolean(mine) && mine === parent;
}

function planned(data: PortalData, studentId: number, weekday: number, day: string) {
  const override = data.attendance.find((mark) => mark.student_id === studentId && mark.day === day);
  if (override) return override.going;
  return data.usual.some((mark) => mark.student_id === studentId && mark.weekday === weekday && mark.going);
}

function Attendance({ data, embedded = false }: { data: PortalData; embedded?: boolean }) {
  const dates = weekDates();
  const staff = isStaff(data.role);
  const days = [...new Set(data.classes.map((row) => row.weekday))].sort((a, b) => a - b);
  const editable = (parentEmail: string) => staff || ownsAthlete(data.viewer_email, parentEmail);
  const save = useSave<{ student_id: number; day: string; going: boolean }>((input) => setAttendance({ data: input }));
  const repeat = useSave(() =>
    saveUsualWeek({
      data: {
        days: dates,
        marks: data.students
          .filter((student) => editable(student.parent_email))
          .flatMap((student) =>
            days.map((weekday) => ({
              student_id: student.id,
              weekday,
              going: planned(data, student.id, weekday, dates[weekday]),
            })),
          ),
      },
    }),
  );
  const mineCount = data.students.filter((student) => ownsAthlete(data.viewer_email, student.parent_email)).length;
  const repeatButton = (
    <button
      type="button"
      disabled={repeat.isPending || !data.students.some((student) => editable(student.parent_email))}
      onClick={() => repeat.mutate(undefined)}
      className="min-h-11 rounded-full bg-blue px-4 text-sm font-semibold text-ink disabled:opacity-60"
    >
      {repeat.isPending ? "Saving…" : "Repeat this week"}
    </button>
  );
  return (
    <div>
      {embedded ? (
        <BlockHead title="This week" action={repeatButton} />
      ) : (
        <PageHead kicker="Who is coming" title="This week" action={repeatButton} />
      )}
      <p className="mb-4 max-w-2xl text-sm text-mute">
        Repeat this week keeps the same checks next week. Changing one day only changes that date.
        {staff
          ? " You can mark anyone. A family can mark an athlete only when their sign-in email matches the parent email on the roster."
          : mineCount
            ? ` You can mark ${mineCount === 1 ? "the athlete" : "the athletes"} tied to ${data.viewer_email}.`
            : ` None of the roster emails match ${data.viewer_email}, so an admin needs to put that address on your athlete.`}
      </p>
      {repeat.isError ? <p className="mb-3 text-sm text-gold">{errText(repeat.error)}</p> : null}
      {repeat.isSuccess ? <p className="mb-3 text-sm text-mute">Saved. Next week starts the same way.</p> : null}
      {days.length ? (
        <div className="space-y-4">
          {days.map((weekday) => {
            const day = dates[weekday];
            const titles = data.classes.filter((row) => row.weekday === weekday).map((row) => row.title);
            const coming = data.students.filter((student) => planned(data, student.id, weekday, day)).length;
            return (
              <section key={weekday} className="rounded-2xl border border-line bg-panel px-4 py-4">
                <h2 className="text-xl">{WEEKDAYS[weekday]} · {formatDay(day)}</h2>
                <p className="text-sm text-gold">{titles.join(" · ")} · {coming} coming</p>
                <ul className="mt-3 divide-y divide-line">
                  {data.students.map((student) => {
                    const on = planned(data, student.id, weekday, day);
                    const can = editable(student.parent_email);
                    return (
                      <li key={student.id} className="flex items-center justify-between gap-3 py-2">
                        <span>
                          {student.student_name}
                          {!staff && can ? <span className="ml-2 text-xs tracking-[0.14em] text-gold uppercase">Yours</span> : null}
                        </span>
                        {can ? (
                          <button
                            type="button"
                            disabled={save.isPending}
                            aria-pressed={on}
                            onClick={() => save.mutate({ student_id: student.id, day, going: !on })}
                            className={"min-h-11 rounded-full px-4 text-sm font-semibold " + (on ? "bg-blue text-ink" : "border border-line text-mute")}
                          >
                            {on ? "Coming" : "Not in"}
                          </button>
                        ) : (
                          <span className={"text-sm " + (on ? "text-paper" : "text-mute")}>{on ? "Coming" : "Not in"}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <p className="text-mute">No classes on the schedule yet.</p>
      )}
      {save.isError ? <p className="mt-3 text-sm text-gold">{errText(save.error)}</p> : null}
    </div>
  );
}

function Board({ data }: { data: PortalData }) {
  const staff = isStaff(data.role);
  const [body, setBody] = useState("");
  const save = useSave(() => postMessage({ data: { body } }));
  return (
    <div>
      <PageHead kicker="Team only" title="Board" />
      <p className="mb-4 max-w-2xl text-sm text-mute">Everyone who is signed in can read and post. Admins can take a message down.</p>
      {data.posts.length ? (
        <ul className="space-y-3">
          {data.posts.map((post) => (
            <li key={post.id} className="rounded-2xl border border-line bg-panel px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm text-gold">{post.author_name}</p>
                <time className="text-xs text-mute">{formatStamp(post.created_at)}</time>
              </div>
              <p className="mt-1 whitespace-pre-wrap">{post.body}</p>
              {staff ? (
                <div className="mt-2">
                  <Remove id={post.id} label="Remove message" run={(id) => deleteMessage({ data: { id } })} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-mute">No messages yet. Say what the team needs to know.</p>
      )}
      <form
        className="mt-4 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate(undefined, { onSuccess: () => setBody("") });
        }}
      >
        <label className="block">
          <span className="sr-only">Message</span>
          <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write to the team" className={field + " min-h-24"} />
        </label>
        <button type="submit" disabled={save.isPending || !body.trim()} className="min-h-11 rounded-lg bg-blue px-4 font-semibold text-ink disabled:opacity-60">
          {save.isPending ? "Posting…" : "Post"}
        </button>
        {save.isError ? <p className="text-sm text-gold">{errText(save.error)}</p> : null}
      </form>
    </div>
  );
}

function Desk({ data }: { data: PortalData }) {
  if (!isStaff(data.role)) {
    return (
      <div>
        <PageHead kicker="Admins only" title="Desk" />
        <p className="text-mute">Admins keep dues, keys, and Wi-Fi here. Families can read the rest of the room.</p>
      </div>
    );
  }
  const owner = data.role === "owner";
  return (
    <div className="space-y-8">
      <PageHead kicker={owner ? "Owner" : "Admin"} title="Desk" />
      <WifiForm settings={data.settings} />
      <DuesLedger data={data} />
      <KeyRoster data={data} />
      {owner ? <SettingsForm settings={data.settings} /> : null}
      <section>
        <h2 className="mb-3 font-display text-3xl tracking-wide">Who can enter</h2>
        <p className="mb-3 max-w-2xl text-sm text-mute">
          {owner
            ? "You are the owner. Make someone an admin when they should edit the roster, dues, and keys. They cannot change codes or other admins."
            : "The owner assigns admins. Admins can edit the roster, mark dues, and update Wi-Fi."}
        </p>
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {data.access.map((member) => (
            <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span>
                <span className="block">{member.name}</span>
                <span className="text-mute">{member.email}</span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-gold">{roleLabel(member.role)}</span>
                {owner && member.role !== "owner" ? (
                  <RoleToggle userId={member.user_id} role={member.role} />
                ) : null}
                {owner && member.role !== "owner" ? <RemoveAccess userId={member.user_id} /> : null}
                {!owner && member.role === "member" ? <RemoveAccess userId={member.user_id} /> : null}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <ClearSample />
    </div>
  );
}

function WifiForm({ settings }: { settings: PortalData["settings"] }) {
  const [form, setForm] = useState({ wifi_name: settings.wifi_name, wifi_password: settings.wifi_password });
  const save = useSave(() => updateWifi({ data: form }));
  return (
    <form
      className="grid gap-3 rounded-2xl border border-line bg-panel p-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(undefined);
      }}
    >
      <h2 className="font-display text-3xl tracking-wide sm:col-span-2">Dojo Wi-Fi</h2>
      <p className="text-sm text-mute sm:col-span-2">Signed-in families see this on the floor. Leave it blank until you want it posted.</p>
      <Field label="Network" value={form.wifi_name} onChange={(wifi_name) => setForm({ ...form, wifi_name })} />
      <Field label="Password" value={form.wifi_password} onChange={(wifi_password) => setForm({ ...form, wifi_password })} />
      <div className="flex items-end">
        <button type="submit" disabled={save.isPending} className="min-h-11 rounded-lg bg-blue px-4 py-2 font-semibold text-ink disabled:opacity-60">
          {save.isPending ? "Saving…" : "Save Wi-Fi"}
        </button>
      </div>
      {save.isError ? <p className="text-sm text-gold sm:col-span-2">{errText(save.error)}</p> : null}
    </form>
  );
}

function DuesLedger({ data }: { data: PortalData }) {
  const [month, setMonth] = useState(monthKey());
  const save = useSave<{ student_id: number; paid: boolean }>((input) => setDues({ data: { month, ...input } }));
  const paidCount = data.students.filter((student) =>
    data.dues.some((due) => due.student_id === student.id && due.month === month && due.paid),
  ).length;
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-3xl tracking-wide">Dues</h2>
        <div className="flex items-center gap-2">
          <button type="button" className="min-h-11 rounded-lg border border-line px-3" onClick={() => setMonth((current) => shiftMonth(current, -1))}>
            Prev
          </button>
          <span className="text-sm tabular-nums">{month}</span>
          <button type="button" className="min-h-11 rounded-lg border border-line px-3" onClick={() => setMonth((current) => shiftMonth(current, 1))}>
            Next
          </button>
        </div>
      </div>
      <p className="mb-3 max-w-2xl text-sm text-mute">
        {paidCount} of {data.students.length} marked paid. Families do not see this list. They use Pay monthly dues on the floor.
      </p>
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {data.students.map((student) => {
          const paid = data.dues.some((due) => due.student_id === student.id && due.month === month && due.paid);
          return (
            <li key={student.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span>
                <span className="block">{student.student_name}</span>
                <span className="text-mute">{student.parent_name}</span>
              </span>
              <button
                type="button"
                disabled={save.isPending}
                onClick={() => save.mutate({ student_id: student.id, paid: !paid })}
                className={"min-h-11 rounded-full px-4 font-semibold " + (paid ? "bg-gold text-ink" : "border border-line text-mute")}
              >
                {paid ? "Paid" : "Not paid"}
              </button>
            </li>
          );
        })}
      </ul>
      {save.isError ? <p className="mt-2 text-sm text-gold">{errText(save.error)}</p> : null}
    </section>
  );
}

function KeyRoster({ data }: { data: PortalData }) {
  const save = useSave<{ student_id: number; has_key: boolean }>((input) => setKey({ data: input }));
  const holders = data.students.filter((student) => student.has_key);
  return (
    <section>
      <h2 className="mb-1 flex items-center gap-2 font-display text-3xl tracking-wide">
        <KeyRound className="size-6 text-gold" /> Keys
      </h2>
      <p className="mb-3 max-w-2xl text-sm text-mute">
        {holders.length ? holders.map((student) => student.parent_name).join(", ") : "No parents are marked with a key yet."}
      </p>
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {data.students.map((student) => (
          <li key={student.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span>
              <span className="block">{student.parent_name}</span>
              <span className="text-mute">{student.student_name}{student.parent_phone ? ` · ${student.parent_phone}` : ""}</span>
            </span>
            <button
              type="button"
              disabled={save.isPending}
              aria-pressed={student.has_key}
              onClick={() => save.mutate({ student_id: student.id, has_key: !student.has_key })}
              className={"min-h-11 rounded-full px-4 font-semibold " + (student.has_key ? "bg-blue text-ink" : "border border-line text-mute")}
            >
              {student.has_key ? "Has a key" : "No key"}
            </button>
          </li>
        ))}
      </ul>
      {save.isError ? <p className="mt-2 text-sm text-gold">{errText(save.error)}</p> : null}
    </section>
  );
}

function RoleToggle({ userId, role }: { userId: string; role: string }) {
  const next = role === "instructor" ? "member" : "instructor";
  const save = useSave(() => setMemberRole({ data: { user_id: userId, role: next } }));
  return (
    <button
      type="button"
      disabled={save.isPending}
      onClick={() => save.mutate(undefined)}
      className="min-h-11 rounded-full border border-line px-3 text-sm"
    >
      {save.isPending ? "Saving…" : role === "instructor" ? "Make family" : "Make admin"}
    </button>
  );
}

function SettingsForm({ settings }: { settings: PortalData["settings"] }) {
  const [form, setForm] = useState(settings);
  const save = useSave(() => updateSettings({ data: form }));
  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  return (
    <form
      className="grid gap-3 rounded-2xl border border-line bg-panel p-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(undefined);
      }}
    >
      <h2 className="font-display text-3xl tracking-wide sm:col-span-2">Team</h2>
      <Field label="Name" value={form.name} onChange={(value) => set("name", value)} />
      <Field label="City" value={form.city} onChange={(value) => set("city", value)} />
      <Field label="Motto" value={form.motto} onChange={(value) => set("motto", value)} />
      <Field label="Parent code" value={form.member_code} onChange={(value) => set("member_code", value.toUpperCase())} />
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-xs tracking-[0.14em] text-mute uppercase">About</span>
        <textarea value={form.about} onChange={(event) => set("about", event.target.value)} className={field + " min-h-28"} />
      </label>
      <Field label="Admin code" value={form.instructor_code} onChange={(value) => set("instructor_code", value.toUpperCase())} />
      <p className="text-xs text-mute sm:col-span-2">
        Codes need at least 8 letters, numbers, or dashes, like JAGUAR-2026. After 5 wrong tries a person waits 15 minutes.
      </p>
      <div className="flex items-end">
        <button type="submit" disabled={save.isPending} className="min-h-11 rounded-lg bg-blue px-4 py-2 font-semibold text-ink disabled:opacity-60">
          {save.isPending ? "Saving…" : "Save desk"}
        </button>
      </div>
      {save.isError ? <p className="text-sm text-gold sm:col-span-2">{errText(save.error)}</p> : null}
      {save.isSuccess ? <p className="text-sm text-mute sm:col-span-2">Saved. New people need the updated code. People already inside stay in.</p> : null}
    </form>
  );
}

function ClearSample() {
  const [armed, setArmed] = useState(false);
  const save = useSave(() => clearSample());
  return (
    <section className="rounded-2xl border border-line px-4 py-4">
      <h2 className="font-display text-3xl tracking-wide">Sample team</h2>
      <p className="mt-1 text-sm text-mute">
        Removes the sample athletes, classes, instructors, cleaning weeks, placements, and sample ring film. The MSKC dates, gear links, and Team uploads album stay.
      </p>
      <button
        type="button"
        className="mt-3 min-h-11 rounded-lg border border-gold px-4 py-2 text-gold"
        onClick={() => {
          if (!armed) {
            setArmed(true);
            return;
          }
          save.mutate(undefined);
        }}
      >
        {save.isPending ? "Clearing…" : armed ? "Confirm clear" : "Clear sample data"}
      </button>
      {save.isError ? <p className="mt-2 text-sm text-gold">{errText(save.error)}</p> : null}
    </section>
  );
}

function RemoveAccess({ userId }: { userId: string }) {
  const [armed, setArmed] = useState(false);
  const save = useSave(() => removeAccess({ data: { user_id: userId } }));
  return (
    <button
      type="button"
      className="min-h-11 text-sm text-mute"
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        save.mutate(undefined);
      }}
    >
      {save.isPending ? "Removing…" : armed ? "Confirm" : "Remove"}
    </button>
  );
}

function useSave<T>(fn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
    },
  });
}

function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
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

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs tracking-[0.14em] text-mute uppercase">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={field} />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs tracking-[0.14em] text-mute uppercase">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={field}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line px-3 text-sm">
      <Pencil className="size-3.5" /> {label}
    </button>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-blue px-4 text-sm font-semibold text-ink">
      <Plus className="size-4" /> {label}
    </button>
  );
}

function Remove({ id, label, run }: { id: number; label: string; run: (id: number) => Promise<unknown> }) {
  const [armed, setArmed] = useState(false);
  const save = useSave(() => run(id));
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center gap-1 text-sm text-mute"
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        save.mutate(undefined);
      }}
    >
      <Trash2 className="size-3.5" /> {save.isPending ? "Removing…" : armed ? "Confirm" : label}
    </button>
  );
}

function ClassEditor({ existing }: { existing?: ClassSession }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    weekday: String(existing?.weekday ?? 1),
    start_time: existing?.start_time ?? "17:30",
    end_time: existing?.end_time ?? "18:20",
    title: existing?.title ?? "",
    room: existing?.room ?? "Main floor",
    instructor: existing?.instructor ?? "",
    ages: existing?.ages ?? "",
    focus: existing?.focus ?? "",
  });
  const save = useSave(() =>
    upsertClass({
      data: {
        id: existing?.id ?? null,
        weekday: Number(form.weekday),
        start_time: form.start_time,
        end_time: form.end_time,
        title: form.title,
        room: form.room,
        instructor: form.instructor,
        ages: form.ages,
        focus: form.focus,
      },
    }),
  );
  return (
    <>
      {existing ? (
        <EditButton label="Edit" onClick={() => setOpen(true)} />
      ) : (
        <AddButton label="Add class" onClick={() => setOpen(true)} />
      )}
      <Sheet open={open} onOpenChange={setOpen} title={existing ? "Edit class" : "Add class"} description="Day, time, and who it’s for.">
        <form
          className="grid gap-3"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            save.mutate(undefined, { onSuccess: () => setOpen(false) });
          }}
        >
          <label className="block">
            <span className="mb-1 block text-xs tracking-[0.14em] text-mute uppercase">Day</span>
            <select
              value={form.weekday}
              onChange={(event) => setForm({ ...form, weekday: event.target.value })}
              className={field}
            >
              {WEEKDAYS.map((label, index) => (
                <option key={label} value={String(index)}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Field label="Start" type="time" value={form.start_time} onChange={(start_time) => setForm({ ...form, start_time })} />
          <Field label="End" type="time" value={form.end_time} onChange={(end_time) => setForm({ ...form, end_time })} />
          <Field label="Class" value={form.title} onChange={(title) => setForm({ ...form, title })} />
          <Field label="Room" value={form.room} onChange={(room) => setForm({ ...form, room })} />
          <Field label="Instructor" value={form.instructor} onChange={(instructor) => setForm({ ...form, instructor })} />
          <Field label="Who" value={form.ages} onChange={(ages) => setForm({ ...form, ages })} />
          <Field label="Focus" value={form.focus} onChange={(focus) => setForm({ ...form, focus })} />
          <SaveButton pending={save.isPending} error={save.isError ? errText(save.error) : ""} />
        </form>
      </Sheet>
    </>
  );
}

function EventEditor({ existing }: { existing?: Tournament }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: existing?.name ?? "",
    event_date: existing?.event_date ?? localDateISO(),
    rating: existing?.rating ?? "AAA",
    presenter: existing?.presenter ?? "",
    venue: existing?.venue ?? "",
    info_url: existing?.info_url ?? "http://www.mskctour.com/Events.aspx",
    notes: existing?.notes ?? "",
  });
  const save = useSave(() => upsertTournament({ data: { id: existing?.id ?? null, ...form } }));
  return (
    <>
      {existing ? <EditButton label="Edit" onClick={() => setOpen(true)} /> : <AddButton label="Add event" onClick={() => setOpen(true)} />}
      <Sheet open={open} onOpenChange={setOpen} title={existing ? "Edit event" : "Add event"} description="Tournaments, banquets, or anything the team travels for.">
        <form
          className="grid gap-3"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            save.mutate(undefined, { onSuccess: () => setOpen(false) });
          }}
        >
          <Field label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
          <Field label="Date" type="date" value={form.event_date} onChange={(event_date) => setForm({ ...form, event_date })} />
          <SelectField label="Rating" value={form.rating || "AAA"} onChange={(rating) => setForm({ ...form, rating })} options={["", ...RATINGS]} />
          <Field label="Presenter" value={form.presenter} onChange={(presenter) => setForm({ ...form, presenter })} />
          <Field label="Venue" value={form.venue} onChange={(venue) => setForm({ ...form, venue })} />
          <Field label="Link" value={form.info_url} onChange={(info_url) => setForm({ ...form, info_url })} />
          <Field label="Notes" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} />
          <SaveButton pending={save.isPending} error={save.isError ? errText(save.error) : ""} />
        </form>
      </Sheet>
    </>
  );
}

function CleaningEditor({ existing }: { existing?: CleaningWeek }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    week_start: existing?.week_start ?? localDateISO(),
    family_name: existing?.family_name ?? "",
    tasks: existing?.tasks ?? "Sweep the floor, wipe the mirrors, empty the trash.",
  });
  const save = useSave(() => upsertCleaning({ data: { id: existing?.id ?? null, ...form } }));
  return (
    <>
      {existing ? <EditButton label="Edit" onClick={() => setOpen(true)} /> : <AddButton label="Add week" onClick={() => setOpen(true)} />}
      <Sheet open={open} onOpenChange={setOpen} title={existing ? "Edit week" : "Add a cleaning week"} description="Pick the Monday the week starts, and the family on duty.">
        <form
          className="grid gap-3"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            save.mutate(undefined, { onSuccess: () => setOpen(false) });
          }}
        >
          <Field label="Week starts" type="date" value={form.week_start} onChange={(week_start) => setForm({ ...form, week_start })} />
          <Field label="Family" value={form.family_name} onChange={(family_name) => setForm({ ...form, family_name })} />
          <Field label="Tasks" value={form.tasks} onChange={(tasks) => setForm({ ...form, tasks })} />
          <SaveButton pending={save.isPending} error={save.isError ? errText(save.error) : ""} />
        </form>
      </Sheet>
    </>
  );
}

function InstructorEditor({ existing }: { existing?: Instructor }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: existing?.name ?? "",
    rank: existing?.rank ?? "",
    role: existing?.role ?? "",
    bio: existing?.bio ?? "",
    email: existing?.email ?? "",
    phone: existing?.phone ?? "",
  });
  const save = useSave(() => upsertInstructor({ data: { id: existing?.id ?? null, ...form } }));
  return (
    <>
      {existing ? <EditButton label="Edit" onClick={() => setOpen(true)} /> : <AddButton label="Add instructor" onClick={() => setOpen(true)} />}
      <Sheet open={open} onOpenChange={setOpen} title={existing ? "Edit instructor" : "Add instructor"} description="Rank, role, and how families reach them.">
        <form
          className="grid gap-3"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            save.mutate(undefined, { onSuccess: () => setOpen(false) });
          }}
        >
          <Field label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
          <Field label="Rank" value={form.rank} onChange={(rank) => setForm({ ...form, rank })} />
          <Field label="Role" value={form.role} onChange={(role) => setForm({ ...form, role })} />
          <Field label="Bio" value={form.bio} onChange={(bio) => setForm({ ...form, bio })} />
          <Field label="Email" value={form.email} onChange={(email) => setForm({ ...form, email })} />
          <Field label="Phone" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
          <SaveButton pending={save.isPending} error={save.isError ? errText(save.error) : ""} />
        </form>
      </Sheet>
    </>
  );
}

function StudentEditor({ existing }: { existing?: Student }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    student_name: existing?.student_name ?? "",
    belt: existing?.belt ?? "White",
    age: existing?.age ? String(existing.age) : "",
    gender: existing?.gender ?? "",
    skill: existing?.skill ?? "",
    style: existing?.style ?? "",
    events: existing?.events ?? "",
    weight_class: existing?.weight_class ?? "",
    parent_name: existing?.parent_name ?? "",
    parent_email: existing?.parent_email ?? "",
    parent_phone: existing?.parent_phone ?? "",
    notes: existing?.notes ?? "",
    has_key: existing?.has_key ?? false,
  });
  const save = useSave(() => upsertStudent({ data: { id: existing?.id ?? null, ...form } }));
  const preview = circuitDivisions({
    belt: form.belt,
    age: form.age ? Number(form.age) : null,
    gender: form.gender,
    skill: form.skill,
    style: form.style,
    events: form.events,
    weight_class: form.weight_class,
  });
  const black = form.belt === "Black";
  const picked = parseEvents(form.events);
  return (
    <>
      {existing ? <EditButton label="Edit" onClick={() => setOpen(true)} /> : <AddButton label="Add athlete" onClick={() => setOpen(true)} />}
      <Sheet open={open} onOpenChange={setOpen} title={existing ? "Edit athlete" : "Add athlete"} description="Kid, belt, and the events they enter.">
        <form
          className="grid gap-3"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            save.mutate(undefined, { onSuccess: () => setOpen(false) });
          }}
        >
          <Field label="Athlete" value={form.student_name} onChange={(student_name) => setForm({ ...form, student_name })} />
          <SelectField label="Belt" value={form.belt} onChange={(belt) => setForm({ ...form, belt })} options={BELTS} />
          <Field label="Age" value={form.age} onChange={(age) => setForm({ ...form, age })} />
          <label className="block">
            <span className="mb-1 block text-xs tracking-[0.14em] text-mute uppercase">Girl or boy</span>
            <select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })} className={field}>
              <option value="">Not set</option>
              <option value="girl">Girl</option>
              <option value="boy">Boy</option>
            </select>
          </label>
          {black ? (
            <label className="block">
              <span className="mb-1 block text-xs tracking-[0.14em] text-mute uppercase">Black belt forms</span>
              <select value={form.style} onChange={(event) => setForm({ ...form, style: event.target.value })} className={field}>
                <option value="">Not set</option>
                {CIRCUIT_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {STYLE_LABEL[style]}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block">
              <span className="mb-1 block text-xs tracking-[0.14em] text-mute uppercase">Underbelt skill</span>
              <select value={form.skill} onChange={(event) => setForm({ ...form, skill: event.target.value })} className={field}>
                <option value="">Not set</option>
                {CIRCUIT_SKILLS.map((skill) => (
                  <option key={skill} value={skill}>
                    {SKILL_LABEL[skill]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div>
            <p className="mb-1 text-xs tracking-[0.14em] text-mute uppercase">They enter</p>
            <div className="flex flex-wrap gap-2">
              {CIRCUIT_EVENTS.map((event) => {
                const on = picked.includes(event);
                return (
                  <button
                    key={event}
                    type="button"
                    aria-pressed={on}
                    className={"min-h-11 rounded-full px-4 text-sm " + (on ? "bg-blue text-ink" : "border border-line text-mute")}
                    onClick={() => {
                      const next = new Set(picked);
                      if (on) next.delete(event);
                      else next.add(event);
                      setForm({ ...form, events: CIRCUIT_EVENTS.filter((item) => next.has(item)).join(",") });
                    }}
                  >
                    {event}
                  </button>
                );
              })}
            </div>
          </div>
          {black && picked.includes("Point Fighting") && Number(form.age) >= 17 && form.gender === "boy" ? (
            <label className="block">
              <span className="mb-1 block text-xs tracking-[0.14em] text-mute uppercase">Men’s weight</span>
              <select value={form.weight_class} onChange={(event) => setForm({ ...form, weight_class: event.target.value })} className={field}>
                <option value="">Not set</option>
                <option value="light">Light, 175 and under</option>
                <option value="heavy">Heavy, over 175</option>
              </select>
            </label>
          ) : null}
          {preview.length ? (
            <ul className="rounded-xl border border-line px-3 py-3 text-sm">
              {preview.map((line) => (
                <li key={line.event}>
                  <span className="text-mute">{line.event}: </span>
                  {line.division || line.note}
                </li>
              ))}
            </ul>
          ) : null}
          <Field label="Parent" value={form.parent_name} onChange={(parent_name) => setForm({ ...form, parent_name })} />
          <Field label="Parent email" value={form.parent_email} onChange={(parent_email) => setForm({ ...form, parent_email })} />
          <Field label="Parent phone" value={form.parent_phone} onChange={(parent_phone) => setForm({ ...form, parent_phone })} />
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.has_key}
              onChange={(event) => setForm({ ...form, has_key: event.target.checked })}
              className="size-5 accent-blue"
            />
            This parent has a dojo key
          </label>
          <Field label="Notes" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} />
          <SaveButton pending={save.isPending} error={save.isError ? errText(save.error) : ""} />
        </form>
      </Sheet>
    </>
  );
}

function VendorEditor({ existing }: { existing?: Vendor }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: existing?.name ?? "",
    url: existing?.url ?? "https://",
    blurb: existing?.blurb ?? "",
    category: existing?.category ?? "Gear",
  });
  const save = useSave(() => upsertVendor({ data: { id: existing?.id ?? null, ...form } }));
  return (
    <>
      {existing ? <EditButton label="Edit" onClick={() => setOpen(true)} /> : <AddButton label="Add link" onClick={() => setOpen(true)} />}
      <Sheet open={open} onOpenChange={setOpen} title={existing ? "Edit link" : "Add a gear link"} description="Any shop or circuit page the team should open.">
        <form
          className="grid gap-3"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            save.mutate(undefined, { onSuccess: () => setOpen(false) });
          }}
        >
          <Field label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
          <Field label="Link" value={form.url} onChange={(url) => setForm({ ...form, url })} />
          <Field label="Note" value={form.blurb} onChange={(blurb) => setForm({ ...form, blurb })} />
          <SelectField label="Group" value={form.category} onChange={(category) => setForm({ ...form, category })} options={["Gear", "Circuit"]} />
          <SaveButton pending={save.isPending} error={save.isError ? errText(save.error) : ""} />
        </form>
      </Sheet>
    </>
  );
}

function suggestedDivision(students: Student[], name: string, discipline: string): string {
  const student = students.find((row) => row.student_name === name);
  if (!student) return "";
  const event = discipline === "Sparring" ? "Point Fighting" : discipline;
  return circuitDivisions(student).find((line) => line.event === event)?.division ?? "";
}

function ResultEditor({ students, tournaments }: { students: Student[]; tournaments: Tournament[] }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    student_name: students[0]?.student_name ?? "",
    division: suggestedDivision(students, students[0]?.student_name ?? "", "Forms") || "Youth intermediate",
    discipline: "Forms",
    event_name: tournaments[0]?.name ?? "",
    event_date: tournaments[0]?.event_date ?? localDateISO(),
    rating: tournaments[0]?.rating || "AAA",
    place: "1",
  });
  const save = useSave(() =>
    upsertResult({
      data: { id: null, ...form, place: Number(form.place) },
    }),
  );
  const preview = pointsFor(form.rating, Number(form.place));
  return (
    <>
      <AddButton label="Log placement" onClick={() => setOpen(true)} />
      <Sheet open={open} onOpenChange={setOpen} title="Log a placement" description="1st through 4th. Points fill in from the MSKC scale.">
        <form
          className="grid gap-3"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            save.mutate(undefined, { onSuccess: () => setOpen(false) });
          }}
        >
          <Field label="Athlete" value={form.student_name} onChange={(student_name) => setForm({ ...form, student_name })} />
          {students.length ? (
            <SelectField
              label="From the roster"
              value={students.some((student) => student.student_name === form.student_name) ? form.student_name : students[0].student_name}
              onChange={(student_name) =>
                setForm({
                  ...form,
                  student_name,
                  division: suggestedDivision(students, student_name, form.discipline) || form.division,
                })
              }
              options={students.map((student) => student.student_name)}
            />
          ) : null}
          <Field label="Division" value={form.division} onChange={(division) => setForm({ ...form, division })} />
          <SelectField
            label="Discipline"
            value={form.discipline}
            onChange={(discipline) =>
              setForm({
                ...form,
                discipline,
                division: suggestedDivision(students, form.student_name, discipline) || form.division,
              })
            }
            options={DISCIPLINES}
          />
          <Field label="Event" value={form.event_name} onChange={(event_name) => setForm({ ...form, event_name })} />
          <Field label="Date" type="date" value={form.event_date} onChange={(event_date) => setForm({ ...form, event_date })} />
          <SelectField label="Rating" value={form.rating} onChange={(rating) => setForm({ ...form, rating })} options={RATINGS} />
          <SelectField label="Place" value={form.place} onChange={(place) => setForm({ ...form, place })} options={["1", "2", "3", "4"]} />
          <p className="text-sm text-gold">{form.rating} {placeLabel(Number(form.place))} is {preview} points.</p>
          <SaveButton pending={save.isPending} error={save.isError ? errText(save.error) : ""} />
        </form>
      </Sheet>
    </>
  );
}

function SaveButton({ pending, error }: { pending: boolean; error: string }) {
  return (
    <div>
      <button type="submit" disabled={pending} className="min-h-11 w-full rounded-lg bg-blue px-4 py-3 font-semibold text-ink disabled:opacity-60">
        {pending ? "Saving…" : "Save"}
      </button>
      {error ? <p className="mt-2 text-sm text-gold">{error}</p> : null}
    </div>
  );
}
