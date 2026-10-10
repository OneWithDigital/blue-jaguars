import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { pointsFor } from "@/lib/dojo";

type Role = "member" | "instructor" | "owner";

export type Settings = {
  name: string;
  city: string;
  motto: string;
  about: string;
  member_code: string;
  instructor_code: string;
  wifi_name: string;
  wifi_password: string;
  dues_url: string;
};

export type ClassSession = {
  id: number;
  weekday: number;
  start_time: string;
  end_time: string;
  title: string;
  room: string;
  instructor: string;
  ages: string;
  focus: string;
  is_sample: boolean;
};

export type Tournament = {
  id: number;
  name: string;
  event_date: string;
  rating: string;
  presenter: string;
  venue: string;
  info_url: string;
  notes: string;
  is_sample: boolean;
};

export type CleaningWeek = {
  id: number;
  week_start: string;
  family_name: string;
  tasks: string;
  done: boolean;
  is_sample: boolean;
};

export type Instructor = {
  id: number;
  name: string;
  rank: string;
  role: string;
  bio: string;
  email: string;
  phone: string;
  is_sample: boolean;
};

export type Student = {
  id: number;
  student_name: string;
  belt: string;
  age: number | null;
  gender: string;
  skill: string;
  style: string;
  events: string;
  weight_class: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  notes: string;
  has_key: boolean;
  is_sample: boolean;
};

export type Vendor = {
  id: number;
  name: string;
  url: string;
  blurb: string;
  category: string;
};

export type MskcResult = {
  id: number;
  student_name: string;
  division: string;
  discipline: string;
  event_name: string;
  event_date: string;
  rating: string;
  place: number;
  points: number;
  is_sample: boolean;
};

export type AttendanceMark = {
  student_id: number;
  day: string;
  going: boolean;
};

export type UsualMark = {
  student_id: number;
  weekday: number;
  going: boolean;
};

export type DueMark = {
  student_id: number;
  month: string;
  paid: boolean;
};

export type BoardPost = {
  id: number;
  user_id: string;
  author_name: string;
  body: string;
  created_at: string;
};

export type AccessMember = {
  user_id: string;
  role: Role;
  name: string;
  email: string;
  joined_at: string;
};

export type PortalData = {
  role: Role;
  settings: Settings;
  classes: ClassSession[];
  tournaments: Tournament[];
  cleaning: CleaningWeek[];
  instructors: Instructor[];
  students: Student[];
  vendors: Vendor[];
  results: MskcResult[];
  attendance: AttendanceMark[];
  usual: UsualMark[];
  viewer_email: string;
  dues: DueMark[];
  posts: BoardPost[];
  access: AccessMember[];
  hasSample: boolean;
};

function asBool(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === 1;
}

function asNum(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

function text(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function required(value: unknown, label: string, max: number): string {
  const next = text(value, max);
  if (!next) throw new Error(`${label} is required`);
  return next;
}

function obj(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") throw new Error("Missing details");
  return input as Record<string, unknown>;
}

function idOf(input: unknown): number {
  const id = asNum(obj(input).id);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Missing id");
  return id;
}

async function roleFor(userId: string): Promise<Role | null> {
  const sql = await getSql();
  await claimOwner(sql, userId);
  const rows = await sql<{ role: string }>`
    select role from dojo_members where user_id = ${userId} limit 1
  `;
  const role = rows[0]?.role;
  if (role === "member" || role === "instructor" || role === "owner") return role;
  return null;
}

async function claimOwner(sql: Awaited<ReturnType<typeof getSql>>, userId: string): Promise<void> {
  const settings = await sql<{ owner_email: string }>`select owner_email from dojo_settings where id = 1`;
  const owner = (settings[0]?.owner_email ?? "").trim().toLowerCase();
  if (!owner) return;
  const users = await sql<{ email: string }>`select email from "user" where id = ${userId} limit 1`;
  const email = (users[0]?.email ?? "").trim().toLowerCase();
  if (!email || email !== owner) return;
  await sql`
    insert into dojo_members (user_id, role) values (${userId}, 'owner')
    on conflict (user_id) do update set role = 'owner'
  `;
}

async function requireMember(userId: string): Promise<Role> {
  const role = await roleFor(userId);
  if (!role) throw new Error("Join the team first");
  return role;
}

async function requireStaff(userId: string): Promise<Role> {
  const role = await requireMember(userId);
  if (role !== "instructor" && role !== "owner") throw new Error("Only admins can change this");
  return role;
}

async function requireOwner(userId: string): Promise<void> {
  const role = await requireMember(userId);
  if (role !== "owner") throw new Error("Only the owner can change this");
}

async function userEmail(sql: Awaited<ReturnType<typeof getSql>>, userId: string): Promise<string> {
  const users = await sql<{ email: string }>`select email from "user" where id = ${userId} limit 1`;
  return (users[0]?.email ?? "").trim().toLowerCase();
}

async function assertCanMark(
  sql: Awaited<ReturnType<typeof getSql>>,
  userId: string,
  role: Role,
  studentId: number,
): Promise<void> {
  if (role === "owner" || role === "instructor") return;
  const email = await userEmail(sql, userId);
  const rows = await sql<{ parent_email: string }>`select parent_email from students where id = ${studentId}`;
  const parent = (rows[0]?.parent_email ?? "").trim().toLowerCase();
  if (!email || parent !== email) throw new Error("You can only mark your own athletes");
}

export const getMembership = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const role = await roleFor(context.userId);
    if (!role) return { joined: false as const };
    return { joined: true as const, role };
  });

export const joinDojo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const code = text(obj(input).code, 40);
    if (code.length < 4) throw new Error("Enter the team code");
    return { code };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const settings = await sql<{ member_code: string; instructor_code: string }>`
      select member_code, instructor_code from dojo_settings where id = 1
    `;
    const row = settings[0];
    if (!row) throw new Error("The dojo is not set up yet");
    const entered = data.code.toUpperCase();
    let role: Role | null = null;
    if (entered === row.instructor_code.trim().toUpperCase()) role = "instructor";
    else if (entered === row.member_code.trim().toUpperCase()) role = "member";
    if (!role) throw new Error("That code does not match");
    const existing = await roleFor(context.userId);
    if (!existing) {
      await sql`
        insert into dojo_members (user_id, role) values (${context.userId}, ${role})
      `;
    } else if (role === "instructor" && existing === "member") {
      await sql`
        update dojo_members set role = 'instructor' where user_id = ${context.userId}
      `;
    }
    await claimOwner(sql, context.userId);
    const next = (await roleFor(context.userId)) ?? role;
    return { role: next };
  });

export const getPortal = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<PortalData> => {
    const role = await requireMember(context.userId);
    const sql = await getSql();
    const settingsRows = await sql<Settings & { owner_email: string }>`
      select name, city, motto, about, member_code, instructor_code, wifi_name, wifi_password, dues_url
      from dojo_settings where id = 1
    `;
    const settings = settingsRows[0];
    if (!settings) throw new Error("The dojo is not set up yet");
    const classes = await sql<ClassSession>`
      select id, weekday, start_time, end_time, title, room, instructor, ages, focus, is_sample
      from class_sessions
      order by weekday, start_time, id
    `;
    const tournaments = await sql<Tournament>`
      select id, name, event_date::text as event_date, rating, presenter, venue, info_url, notes, is_sample
      from tournaments
      order by event_date, id
    `;
    const cleaning = await sql<CleaningWeek>`
      select id, week_start::text as week_start, family_name, tasks, done, is_sample
      from cleaning_weeks
      order by week_start, id
    `;
    const instructors = await sql<Instructor>`
      select id, name, rank, role, bio, email, phone, is_sample
      from instructors
      order by id
    `;
    const students = await sql<Student>`
      select id, student_name, belt, age, gender, skill, style, events, weight_class,
             parent_name, parent_email, parent_phone, notes, has_key, is_sample
      from students
      order by student_name, id
    `;
    const vendors = await sql<Vendor>`
      select id, name, url, blurb, category from vendors order by category, name, id
    `;
    const results = await sql<MskcResult>`
      select id, student_name, division, discipline, event_name, event_date::text as event_date,
             rating, place, points, is_sample
      from mskc_results
      order by event_date desc, id desc
    `;
    const staff = role === "instructor" || role === "owner";
    const access = staff
      ? await sql<AccessMember>`
          select m.user_id, m.role, u.name, u.email, m.joined_at::text as joined_at
          from dojo_members m
          join "user" u on u.id = m.user_id
          order by m.joined_at
        `
      : [];
    const attendance = await sql<AttendanceMark>`
      select student_id, day::text as day, going
      from attendance
      where day >= current_date - 1 and day < current_date + 14
      order by day, student_id
    `;
    const usual = await sql<UsualMark>`
      select student_id, weekday, going from attendance_usual order by student_id, weekday
    `;
    const viewer_email = await userEmail(sql, context.userId);
    const dues = staff
      ? await sql<DueMark>`
          select student_id, month, paid from dues order by month, student_id
        `
      : [];
    const posts = await sql<BoardPost>`
      select id, user_id, author_name, body, created_at::text as created_at
      from (
        select id, user_id, author_name, body, created_at
        from board_posts
        order by created_at desc
        limit 80
      ) recent
      order by created_at asc
    `;
    const visibleSettings: Settings = {
      ...settings,
      member_code: role === "owner" ? settings.member_code : "",
      instructor_code: role === "owner" ? settings.instructor_code : "",
    };
    const gallerySample = await sql<{ s: boolean }>`
      select exists(select 1 from gallery_items where is_sample = true) as s
    `;
    const hasSample =
      classes.some((row) => asBool(row.is_sample)) ||
      instructors.some((row) => asBool(row.is_sample)) ||
      students.some((row) => asBool(row.is_sample)) ||
      cleaning.some((row) => asBool(row.is_sample)) ||
      results.some((row) => asBool(row.is_sample)) ||
      asBool(gallerySample[0]?.s);
    return {
      role,
      settings: visibleSettings,
      classes: classes.map((row) => ({ ...row, id: asNum(row.id), weekday: asNum(row.weekday), is_sample: asBool(row.is_sample) })),
      tournaments: tournaments.map((row) => ({ ...row, id: asNum(row.id), is_sample: asBool(row.is_sample) })),
      cleaning: cleaning.map((row) => ({ ...row, id: asNum(row.id), done: asBool(row.done), is_sample: asBool(row.is_sample) })),
      instructors: instructors.map((row) => ({ ...row, id: asNum(row.id), is_sample: asBool(row.is_sample) })),
      students: students.map((row) => ({
        ...row,
        id: asNum(row.id),
        age: row.age == null ? null : asNum(row.age),
        has_key: staff ? asBool(row.has_key) : false,
        is_sample: asBool(row.is_sample),
      })),
      vendors: vendors.map((row) => ({ ...row, id: asNum(row.id) })),
      results: results.map((row) => ({
        ...row,
        id: asNum(row.id),
        place: asNum(row.place),
        points: asNum(row.points),
        is_sample: asBool(row.is_sample),
      })),
      access: access.map((row) => ({
        ...row,
        role: row.role === "owner" || row.role === "instructor" ? row.role : "member",
      })),
      attendance: attendance.map((row) => ({ ...row, student_id: asNum(row.student_id), going: asBool(row.going) })),
      usual: usual.map((row) => ({ ...row, student_id: asNum(row.student_id), weekday: asNum(row.weekday), going: asBool(row.going) })),
      viewer_email,
      dues: dues.map((row) => ({ ...row, student_id: asNum(row.student_id), paid: asBool(row.paid) })),
      posts: posts.map((row) => ({ ...row, id: asNum(row.id) })),
      hasSample,
    };
  });

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = obj(input);
    const member_code = required(raw.member_code, "Parent code", 40).toUpperCase();
    const instructor_code = required(raw.instructor_code, "Instructor code", 40).toUpperCase();
    if (member_code === instructor_code) throw new Error("The two codes need to be different");
    return {
      name: required(raw.name, "Team name", 80),
      city: required(raw.city, "City", 80),
      motto: required(raw.motto, "Motto", 120),
      about: required(raw.about, "About", 600),
      member_code,
      instructor_code,
    };
  })
  .handler(async ({ context, data }) => {
    await requireOwner(context.userId);
    const sql = await getSql();
    await sql`
      update dojo_settings set
        name = ${data.name},
        city = ${data.city},
        motto = ${data.motto},
        about = ${data.about},
        member_code = ${data.member_code},
        instructor_code = ${data.instructor_code}
      where id = 1
    `;
    return { ok: true };
  });

export const upsertClass = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = obj(input);
    const weekday = asNum(raw.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new Error("Pick a day");
    const id = raw.id == null || raw.id === "" ? null : asNum(raw.id);
    return {
      id,
      weekday,
      start_time: required(raw.start_time, "Start", 8),
      end_time: required(raw.end_time, "End", 8),
      title: required(raw.title, "Class name", 80),
      room: required(raw.room, "Room", 80),
      instructor: required(raw.instructor, "Instructor", 80),
      ages: required(raw.ages, "Who it is for", 80),
      focus: text(raw.focus, 160),
    };
  })
  .handler(async ({ context, data }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    if (data.id) {
      await sql`
        update class_sessions set
          weekday = ${data.weekday},
          start_time = ${data.start_time},
          end_time = ${data.end_time},
          title = ${data.title},
          room = ${data.room},
          instructor = ${data.instructor},
          ages = ${data.ages},
          focus = ${data.focus},
          is_sample = false
        where id = ${data.id}
      `;
    } else {
      await sql`
        insert into class_sessions (weekday, start_time, end_time, title, room, instructor, ages, focus, is_sample)
        values (${data.weekday}, ${data.start_time}, ${data.end_time}, ${data.title}, ${data.room}, ${data.instructor}, ${data.ages}, ${data.focus}, false)
      `;
    }
    return { ok: true };
  });

export const deleteClass = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(idOf)
  .handler(async ({ context, data }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    await sql`delete from class_sessions where id = ${data}`;
    return { ok: true };
  });

export const upsertTournament = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = obj(input);
    const event_date = required(raw.event_date, "Date", 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event_date)) throw new Error("Use a real date");
    const id = raw.id == null || raw.id === "" ? null : asNum(raw.id);
    return {
      id,
      name: required(raw.name, "Event", 120),
      event_date,
      rating: text(raw.rating, 8),
      presenter: text(raw.presenter, 120),
      venue: text(raw.venue, 180),
      info_url: text(raw.info_url, 300),
      notes: text(raw.notes, 400),
    };
  })
  .handler(async ({ context, data }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    if (data.id) {
      await sql`
        update tournaments set
          name = ${data.name},
          event_date = ${data.event_date},
          rating = ${data.rating},
          presenter = ${data.presenter},
          venue = ${data.venue},
          info_url = ${data.info_url},
          notes = ${data.notes},
          is_sample = false
        where id = ${data.id}
      `;
    } else {
      await sql`
        insert into tournaments (name, event_date, rating, presenter, venue, info_url, notes, is_sample)
        values (${data.name}, ${data.event_date}, ${data.rating}, ${data.presenter}, ${data.venue}, ${data.info_url}, ${data.notes}, false)
      `;
    }
    return { ok: true };
  });

export const deleteTournament = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(idOf)
  .handler(async ({ context, data }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    await sql`delete from tournaments where id = ${data}`;
    return { ok: true };
  });

export const upsertCleaning = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = obj(input);
    const week_start = required(raw.week_start, "Week", 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week_start)) throw new Error("Use a real date");
    const id = raw.id == null || raw.id === "" ? null : asNum(raw.id);
    return {
      id,
      week_start,
      family_name: required(raw.family_name, "Family", 80),
      tasks: required(raw.tasks, "Tasks", 300),
    };
  })
  .handler(async ({ context, data }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    if (data.id) {
      await sql`
        update cleaning_weeks set
          week_start = ${data.week_start},
          family_name = ${data.family_name},
          tasks = ${data.tasks},
          is_sample = false
        where id = ${data.id}
      `;
    } else {
      await sql`
        insert into cleaning_weeks (week_start, family_name, tasks, done, is_sample)
        values (${data.week_start}, ${data.family_name}, ${data.tasks}, false, false)
      `;
    }
    return { ok: true };
  });

export const toggleCleaning = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(idOf)
  .handler(async ({ context, data }) => {
    await requireMember(context.userId);
    const sql = await getSql();
    await sql`update cleaning_weeks set done = not done where id = ${data}`;
    return { ok: true };
  });

export const deleteCleaning = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(idOf)
  .handler(async ({ context, data }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    await sql`delete from cleaning_weeks where id = ${data}`;
    return { ok: true };
  });

export const upsertInstructor = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = obj(input);
    const id = raw.id == null || raw.id === "" ? null : asNum(raw.id);
    return {
      id,
      name: required(raw.name, "Name", 80),
      rank: required(raw.rank, "Rank", 40),
      role: required(raw.role, "Role", 80),
      bio: text(raw.bio, 500),
      email: text(raw.email, 120),
      phone: text(raw.phone, 40),
    };
  })
  .handler(async ({ context, data }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    if (data.id) {
      await sql`
        update instructors set
          name = ${data.name}, rank = ${data.rank}, role = ${data.role},
          bio = ${data.bio}, email = ${data.email}, phone = ${data.phone}, is_sample = false
        where id = ${data.id}
      `;
    } else {
      await sql`
        insert into instructors (name, rank, role, bio, email, phone, is_sample)
        values (${data.name}, ${data.rank}, ${data.role}, ${data.bio}, ${data.email}, ${data.phone}, false)
      `;
    }
    return { ok: true };
  });

export const deleteInstructor = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(idOf)
  .handler(async ({ context, data }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    await sql`delete from instructors where id = ${data}`;
    return { ok: true };
  });

export const upsertStudent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = obj(input);
    const id = raw.id == null || raw.id === "" ? null : asNum(raw.id);
    const ageRaw = text(raw.age, 3);
    let age: number | null = null;
    if (ageRaw) {
      age = Number(ageRaw);
      if (!Number.isInteger(age) || age < 3 || age > 99) throw new Error("Age should be between 3 and 99");
    }
    const gender = text(raw.gender, 8);
    if (gender && gender !== "girl" && gender !== "boy") throw new Error("Pick girl or boy");
    const skill = text(raw.skill, 8);
    if (skill && skill !== "NOV" && skill !== "INT" && skill !== "ADV") throw new Error("Pick a skill level");
    const style = text(raw.style, 8);
    if (style && style !== "TRAD" && style !== "OPEN") throw new Error("Pick traditional or open");
    const weight_class = text(raw.weight_class, 8);
    if (weight_class && weight_class !== "light" && weight_class !== "heavy") throw new Error("Pick a weight class");
    const events = ["Forms", "Weapons", "Point Fighting"].filter((event) => text(raw.events, 80).split(",").map((part) => part.trim()).includes(event)).join(",");
    return {
      id,
      student_name: required(raw.student_name, "Athlete", 80),
      belt: required(raw.belt, "Belt", 20),
      age,
      gender,
      skill,
      style,
      events,
      weight_class,
      parent_name: required(raw.parent_name, "Parent", 80),
      parent_email: text(raw.parent_email, 120),
      parent_phone: text(raw.parent_phone, 40),
      notes: text(raw.notes, 240),
      has_key: raw.has_key === true || raw.has_key === "true",
    };
  })
  .handler(async ({ context, data }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    if (data.id) {
      const prev = await sql<{ student_name: string }>`select student_name from students where id = ${data.id}`;
      await sql`
        update students set
          student_name = ${data.student_name},
          belt = ${data.belt},
          age = ${data.age},
          gender = ${data.gender},
          skill = ${data.skill},
          style = ${data.style},
          events = ${data.events},
          weight_class = ${data.weight_class},
          parent_name = ${data.parent_name},
          parent_email = ${data.parent_email},
          parent_phone = ${data.parent_phone},
          notes = ${data.notes},
          has_key = ${data.has_key},
          is_sample = false
        where id = ${data.id}
      `;
      const oldName = prev[0]?.student_name;
      if (oldName && oldName !== data.student_name) {
        await sql`
          update mskc_results set student_name = ${data.student_name} where student_name = ${oldName}
        `;
      }
    } else {
      await sql`
        insert into students (
          student_name, belt, age, gender, skill, style, events, weight_class,
          parent_name, parent_email, parent_phone, notes, has_key, is_sample
        )
        values (
          ${data.student_name}, ${data.belt}, ${data.age}, ${data.gender}, ${data.skill}, ${data.style},
          ${data.events}, ${data.weight_class}, ${data.parent_name}, ${data.parent_email}, ${data.parent_phone},
          ${data.notes}, ${data.has_key}, false
        )
      `;
    }
    return { ok: true };
  });

export const deleteStudent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(idOf)
  .handler(async ({ context, data }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    const rows = await sql<{ student_name: string }>`select student_name from students where id = ${data}`;
    const name = rows[0]?.student_name;
    // Placements are keyed by name, not id, so they do not cascade. Remove them
    // with the athlete, unless another roster entry shares the same name.
    if (name) {
      const twins = await sql<{ n: number }>`
        select count(*)::int as n from students where student_name = ${name} and id <> ${data}
      `;
      if (!asNum(twins[0]?.n)) {
        await sql`delete from mskc_results where student_name = ${name}`;
      }
    }
    await sql`delete from students where id = ${data}`;
    return { ok: true };
  });

export const upsertVendor = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = obj(input);
    const id = raw.id == null || raw.id === "" ? null : asNum(raw.id);
    const url = required(raw.url, "Link", 300);
    if (!/^https?:\/\//i.test(url)) throw new Error("Link should start with http");
    return {
      id,
      name: required(raw.name, "Name", 80),
      url,
      blurb: text(raw.blurb, 180),
      category: text(raw.category, 40) || "Gear",
    };
  })
  .handler(async ({ context, data }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    if (data.id) {
      await sql`
        update vendors set name = ${data.name}, url = ${data.url}, blurb = ${data.blurb}, category = ${data.category}
        where id = ${data.id}
      `;
    } else {
      await sql`
        insert into vendors (name, url, blurb, category)
        values (${data.name}, ${data.url}, ${data.blurb}, ${data.category})
      `;
    }
    return { ok: true };
  });

export const deleteVendor = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(idOf)
  .handler(async ({ context, data }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    await sql`delete from vendors where id = ${data}`;
    return { ok: true };
  });

export const upsertResult = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = obj(input);
    const place = asNum(raw.place);
    if (!Number.isInteger(place) || place < 1 || place > 4) throw new Error("Place is 1st through 4th");
    const rating = required(raw.rating, "Rating", 8).toUpperCase();
    if (!["AAA", "AA", "A"].includes(rating)) throw new Error("Rating is AAA, AA, or A");
    const event_date = required(raw.event_date, "Date", 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event_date)) throw new Error("Use a real date");
    const id = raw.id == null || raw.id === "" ? null : asNum(raw.id);
    const points = pointsFor(rating, place);
    return {
      id,
      student_name: required(raw.student_name, "Athlete", 80),
      division: required(raw.division, "Division", 80),
      discipline: required(raw.discipline, "Discipline", 20),
      event_name: required(raw.event_name, "Event", 120),
      event_date,
      rating,
      place,
      points,
    };
  })
  .handler(async ({ context, data }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    if (data.id) {
      await sql`
        update mskc_results set
          student_name = ${data.student_name},
          division = ${data.division},
          discipline = ${data.discipline},
          event_name = ${data.event_name},
          event_date = ${data.event_date},
          rating = ${data.rating},
          place = ${data.place},
          points = ${data.points},
          is_sample = false
        where id = ${data.id}
      `;
    } else {
      await sql`
        insert into mskc_results
          (student_name, division, discipline, event_name, event_date, rating, place, points, is_sample)
        values
          (${data.student_name}, ${data.division}, ${data.discipline}, ${data.event_name}, ${data.event_date}, ${data.rating}, ${data.place}, ${data.points}, false)
      `;
    }
    return { ok: true, points: data.points };
  });

export const deleteResult = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(idOf)
  .handler(async ({ context, data }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    await sql`delete from mskc_results where id = ${data}`;
    return { ok: true };
  });

export const removeAccess = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const user_id = required(obj(input).user_id, "Member", 80);
    return { user_id };
  })
  .handler(async ({ context, data }) => {
    await requireStaff(context.userId);
    if (data.user_id === context.userId) throw new Error("You can't remove yourself");
    const sql = await getSql();
    const caller = await roleFor(context.userId);
    const target = await sql<{ role: string }>`select role from dojo_members where user_id = ${data.user_id}`;
    const targetRole = target[0]?.role;
    if (!targetRole) return { ok: true };
    if (targetRole === "owner") throw new Error("The owner stays");
    if (targetRole === "instructor" && caller !== "owner") throw new Error("Only the owner can remove an admin");
    await sql`delete from dojo_members where user_id = ${data.user_id}`;
    return { ok: true };
  });

export const clearSample = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    await sql`delete from class_sessions where is_sample = true`;
    await sql`delete from instructors where is_sample = true`;
    await sql`delete from students where is_sample = true`;
    await sql`delete from cleaning_weeks where is_sample = true`;
    await sql`delete from mskc_results where is_sample = true`;
    await sql`delete from gallery_albums where is_sample = true`;
    return { ok: true };
  });

function isoDay(value: unknown): string {
  const day = text(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Pick a day");
  return day;
}

function isoMonth(value: unknown): string {
  const month = text(value, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Pick a month");
  return month;
}

export const updateWifi = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = obj(input);
    return {
      wifi_name: text(raw.wifi_name, 80),
      wifi_password: text(raw.wifi_password, 80),
    };
  })
  .handler(async ({ context, data }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    await sql`
      update dojo_settings set wifi_name = ${data.wifi_name}, wifi_password = ${data.wifi_password} where id = 1
    `;
    return { ok: true };
  });

export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = obj(input);
    const role = text(raw.role, 20);
    if (role !== "member" && role !== "instructor") throw new Error("Pick family or admin");
    return { user_id: required(raw.user_id, "Member", 80), role };
  })
  .handler(async ({ context, data }) => {
    await requireOwner(context.userId);
    if (data.user_id === context.userId) throw new Error("Your owner role stays with this email");
    const sql = await getSql();
    const target = await sql<{ role: string }>`select role from dojo_members where user_id = ${data.user_id}`;
    if (!target[0]) throw new Error("That person is not in the team");
    if (target[0].role === "owner") throw new Error("The owner stays");
    await sql`update dojo_members set role = ${data.role} where user_id = ${data.user_id}`;
    return { ok: true };
  });

export const setAttendance = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = obj(input);
    const student_id = asNum(raw.student_id);
    if (!Number.isInteger(student_id) || student_id <= 0) throw new Error("Pick an athlete");
    return { student_id, day: isoDay(raw.day), going: raw.going === true || raw.going === "true" };
  })
  .handler(async ({ context, data }) => {
    const role = await requireMember(context.userId);
    const sql = await getSql();
    await assertCanMark(sql, context.userId, role, data.student_id);
    await sql`
      insert into attendance (student_id, day, going)
      values (${data.student_id}, ${data.day}, ${data.going})
      on conflict (student_id, day) do update set going = ${data.going}
    `;
    return { ok: true };
  });

export const saveUsualWeek = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = obj(input);
    if (!Array.isArray(raw.marks) || raw.marks.length > 400) throw new Error("Missing the week");
    const marks = raw.marks.map((item) => {
      const row = obj(item);
      const student_id = asNum(row.student_id);
      const weekday = asNum(row.weekday);
      if (!Number.isInteger(student_id) || student_id <= 0) throw new Error("Pick an athlete");
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new Error("Pick a day");
      return { student_id, weekday, going: row.going === true || row.going === "true" };
    });
    if (!Array.isArray(raw.days) || raw.days.length > 7) throw new Error("Missing the week");
    const days = raw.days.map((day) => isoDay(day));
    return { marks, days };
  })
  .handler(async ({ context, data }) => {
    const role = await requireMember(context.userId);
    const sql = await getSql();
    const ids = [...new Set(data.marks.map((mark) => mark.student_id))];
    for (const studentId of ids) await assertCanMark(sql, context.userId, role, studentId);
    for (const mark of data.marks) {
      await sql`
        insert into attendance_usual (student_id, weekday, going)
        values (${mark.student_id}, ${mark.weekday}, ${mark.going})
        on conflict (student_id, weekday) do update set going = ${mark.going}
      `;
    }
    if (ids.length && data.days.length) {
      await sql`
        delete from attendance
        where student_id = any(${ids}) and day = any(${data.days}::date[])
      `;
    }
    return { ok: true };
  });

export const setDues = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = obj(input);
    const student_id = asNum(raw.student_id);
    if (!Number.isInteger(student_id) || student_id <= 0) throw new Error("Pick an athlete");
    return { student_id, month: isoMonth(raw.month), paid: raw.paid === true || raw.paid === "true" };
  })
  .handler(async ({ context, data }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    await sql`
      insert into dues (student_id, month, paid)
      values (${data.student_id}, ${data.month}, ${data.paid})
      on conflict (student_id, month) do update set paid = ${data.paid}
    `;
    return { ok: true };
  });

export const setKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = obj(input);
    const student_id = asNum(raw.student_id);
    if (!Number.isInteger(student_id) || student_id <= 0) throw new Error("Pick a family");
    return { student_id, has_key: raw.has_key === true || raw.has_key === "true" };
  })
  .handler(async ({ context, data }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    await sql`update students set has_key = ${data.has_key} where id = ${data.student_id}`;
    return { ok: true };
  });

export const postMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = required(obj(input).body, "Message", 800);
    return { body };
  })
  .handler(async ({ context, data }) => {
    await requireMember(context.userId);
    const sql = await getSql();
    const users = await sql<{ name: string }>`select name from "user" where id = ${context.userId} limit 1`;
    const author = (users[0]?.name ?? "").trim() || "Team";
    await sql`
      insert into board_posts (user_id, author_name, body) values (${context.userId}, ${author}, ${data.body})
    `;
    return { ok: true };
  });

export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(idOf)
  .handler(async ({ context, data }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    await sql`delete from board_posts where id = ${data}`;
    return { ok: true };
  });


