import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

type Role = "member" | "instructor" | "owner";

export type GalleryAlbum = {
  id: number;
  title: string;
  event_date: string;
  notes: string;
  is_sample: boolean;
};

export type GalleryItem = {
  id: number;
  album_id: number;
  kind: "photo" | "video";
  title: string;
  athlete: string;
  discipline: string;
  caption: string;
  poster: string;
  video_url: string;
  has_file: boolean;
  is_sample: boolean;
  can_edit: boolean;
};

export type GalleryData = {
  albums: GalleryAlbum[];
  items: GalleryItem[];
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

function dateOrEmpty(value: unknown): string {
  const raw = text(value, 10);
  if (!raw) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error("Use a real date");
  return raw;
}

function httpUrl(value: unknown): string {
  const raw = text(value, 500);
  if (!raw) return "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That link needs a full web address, including https://");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Use an http or https link");
  return url.toString();
}

function dataUrl(value: unknown, label: string, max: number, kind: "image" | "video"): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const pattern =
    kind === "image"
      ? /^data:image\/(?:jpeg|jpg|png|webp);base64,[a-z0-9+/=\s]+$/i
      : /^data:video\/(?:mp4|webm|quicktime);base64,[a-z0-9+/=\s]+$/i;
  if (!pattern.test(raw) || raw.length > max) {
    throw new Error(
      kind === "image"
        ? `${label} is too large or not a photo. Try a smaller JPG.`
        : "That clip is too large to keep here. Post it on YouTube or Facebook and paste the link.",
    );
  }
  return raw;
}

async function roleFor(userId: string): Promise<Role | null> {
  const sql = await getSql();
  const rows = await sql<{ role: string }>`
    select role from dojo_members where user_id = ${userId} limit 1
  `;
  const role = rows[0]?.role;
  if (role === "member" || role === "instructor" || role === "owner") return role;
  return null;
}

async function requireMember(userId: string): Promise<Role> {
  const role = await roleFor(userId);
  if (!role) throw new Error("Join the team first");
  return role;
}

async function requireInstructor(userId: string): Promise<void> {
  const role = await requireMember(userId);
  if (role !== "instructor" && role !== "owner") throw new Error("Only admins can change albums");
}

type ItemRow = {
  id: number;
  album_id: number;
  kind: string;
  title: string;
  athlete: string;
  discipline: string;
  caption: string;
  poster: string;
  video_url: string;
  is_sample: boolean;
  added_by: string;
  has_file: boolean;
};

async function loadItem(id: number): Promise<ItemRow | null> {
  const sql = await getSql();
  const rows = await sql<ItemRow>`
    select i.id, i.album_id, i.kind, i.title, i.athlete, i.discipline, i.caption,
           i.poster, i.video_url, i.is_sample, i.added_by,
           (b.item_id is not null) as has_file
    from gallery_items i
    left join gallery_blobs b on b.item_id = i.id
    where i.id = ${id}
  `;
  return rows[0] ?? null;
}

function canEdit(role: Role, userId: string, item: { is_sample: boolean; added_by: string }): boolean {
  if (role === "instructor" || role === "owner") return true;
  return !asBool(item.is_sample) && item.added_by === userId;
}

async function assertAlbum(id: number): Promise<void> {
  const sql = await getSql();
  const rows = await sql<{ id: number }>`select id from gallery_albums where id = ${id}`;
  if (!rows[0]) throw new Error("Pick an album");
}

// ---------- YouTube channel import ----------
// Public videos on the club channel are pulled from YouTube's RSS feed (no API
// key) into a "YouTube channel" album. Checked at most every 30 minutes when
// someone opens Film; admins can force a check. Unlisted and private videos are
// not in the feed.
const YOUTUBE_REFRESH_MS = 30 * 60 * 1000;

type FeedVideo = { id: string; title: string; description: string; published: string };

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
    .trim();
}

function tag(block: string, name: string): string {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return match ? decodeXml(match[1]) : "";
}

async function fetchChannelFeed(channelId: string): Promise<FeedVideo[] | "none"> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`, {
    signal: AbortSignal.timeout(6000),
    headers: { accept: "application/atom+xml, application/xml" },
  });
  // YouTube answers 404 for a channel with no public videos yet.
  if (res.status === 404) return "none";
  if (!res.ok) throw new Error(`YouTube answered ${res.status}`);
  const xml = await res.text();
  const videos: FeedVideo[] = [];
  for (const entry of xml.split("<entry>").slice(1)) {
    const id = tag(entry, "yt:videoId");
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) continue;
    videos.push({
      id,
      title: tag(entry, "title").slice(0, 120) || "Club video",
      description: tag(entry, "media:description").slice(0, 400),
      published: tag(entry, "published"),
    });
  }
  return videos;
}

async function youtubeAlbumId(): Promise<number> {
  const sql = await getSql();
  const found = await sql<{ id: number }>`select id from gallery_albums where source = 'youtube' order by id limit 1`;
  if (found[0]) return asNum(found[0].id);
  const made = await sql<{ id: number }>`
    insert into gallery_albums (title, event_date, notes, is_sample, source)
    values ('YouTube channel', null, 'New public videos from the club YouTube channel show up here on their own.', false, 'youtube')
    returning id
  `;
  return asNum(made[0]?.id);
}

export async function syncYouTube(force = false): Promise<{ added: number; status: "ok" | "none" | "skipped" | "off" }> {
  const sql = await getSql();
  const rows = await sql<{ channel: string; synced: string | null }>`
    select youtube_channel_id as channel, youtube_synced_at::text as synced from dojo_settings where id = 1
  `;
  const channel = (rows[0]?.channel ?? "").trim();
  if (!channel) return { added: 0, status: "off" };
  const last = rows[0]?.synced ? Date.parse(rows[0].synced) : 0;
  if (!force && last && Date.now() - last < YOUTUBE_REFRESH_MS) return { added: 0, status: "skipped" };
  // Stamp first so parallel page loads don't all call YouTube.
  await sql`update dojo_settings set youtube_synced_at = now() where id = 1`;
  const feed = await fetchChannelFeed(channel);
  if (feed === "none") return { added: 0, status: "none" };
  if (!feed.length) return { added: 0, status: "ok" };
  const albumId = await youtubeAlbumId();
  let added = 0;
  for (const video of [...feed].reverse()) {
    const published = Number.isNaN(Date.parse(video.published)) ? new Date().toISOString() : video.published;
    const inserted = await sql<{ id: number }>`
      insert into gallery_items
        (album_id, kind, title, caption, poster, video_url, is_sample, added_by, youtube_id, created_at)
      select ${albumId}, 'video', ${video.title}, ${video.description},
             ${`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`},
             ${`https://www.youtube.com/watch?v=${video.id}`}, false, 'youtube', ${video.id}, ${published}
      where not exists (select 1 from gallery_items where youtube_id = ${video.id})
      returning id
    `;
    if (inserted[0]) added += 1;
  }
  return { added, status: "ok" };
}

export const syncYouTubeNow = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireInstructor(context.userId);
    try {
      return await syncYouTube(true);
    } catch (error) {
      throw new Error(`Could not reach YouTube: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  });

export const getGallery = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<GalleryData> => {
    const role = await requireMember(context.userId);
    try {
      await syncYouTube(false);
    } catch (error) {
      console.error("[youtube] sync failed:", error instanceof Error ? error.message : error);
    }
    const sql = await getSql();
    const albums = await sql<GalleryAlbum>`
      select id, title, coalesce(event_date::text, '') as event_date, notes, is_sample
      from gallery_albums
      order by event_date desc nulls last, id asc
    `;
    const items = await sql<ItemRow>`
      select i.id, i.album_id, i.kind, i.title, i.athlete, i.discipline, i.caption,
             i.poster, i.video_url, i.is_sample, i.added_by,
             (b.item_id is not null) as has_file
      from gallery_items i
      left join gallery_blobs b on b.item_id = i.id
      order by i.id asc
    `;
    return {
      albums: albums.map((row) => ({
        ...row,
        id: asNum(row.id),
        is_sample: asBool(row.is_sample),
      })),
      items: items.map((row) => ({
        id: asNum(row.id),
        album_id: asNum(row.album_id),
        kind: row.kind === "video" ? "video" : "photo",
        title: row.title,
        athlete: row.athlete,
        discipline: row.discipline,
        caption: row.caption,
        poster: row.poster,
        video_url: row.video_url,
        has_file: asBool(row.has_file),
        is_sample: asBool(row.is_sample),
        can_edit: canEdit(role, context.userId, row),
      })),
    };
  });

export const getGalleryFile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(idOf)
  .handler(async ({ context, data }) => {
    await requireMember(context.userId);
    const sql = await getSql();
    const rows = await sql<{ data: string }>`
      select data from gallery_blobs where item_id = ${data}
    `;
    const file = rows[0]?.data;
    if (!file) throw new Error("That file is not stored here");
    return { data: file };
  });

export const addGalleryPhoto = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = obj(input);
    const album_id = asNum(raw.album_id);
    if (!Number.isInteger(album_id) || album_id <= 0) throw new Error("Pick an album");
    return {
      album_id,
      title: required(raw.title, "Title", 120),
      athlete: text(raw.athlete, 80),
      discipline: text(raw.discipline, 20),
      caption: text(raw.caption, 400),
      poster: dataUrl(raw.poster, "Thumbnail", 350_000, "image"),
      file: dataUrl(raw.file, "Photo", 1_200_000, "image"),
    };
  })
  .handler(async ({ context, data }) => {
    await requireMember(context.userId);
    if (!data.file) throw new Error("Choose a photo");
    await assertAlbum(data.album_id);
    const sql = await getSql();
    const inserted = await sql<{ id: number }>`
      insert into gallery_items
        (album_id, kind, title, athlete, discipline, caption, poster, video_url, is_sample, added_by)
      values
        (${data.album_id}, 'photo', ${data.title}, ${data.athlete}, ${data.discipline}, ${data.caption}, ${data.poster}, '', false, ${context.userId})
      returning id
    `;
    const id = asNum(inserted[0]?.id);
    if (!id) throw new Error("Could not save that photo");
    try {
      await sql`insert into gallery_blobs (item_id, data) values (${id}, ${data.file})`;
    } catch (error) {
      await sql`delete from gallery_items where id = ${id}`;
      throw error;
    }
    return { id };
  });

export const addGalleryVideo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = obj(input);
    const album_id = asNum(raw.album_id);
    if (!Number.isInteger(album_id) || album_id <= 0) throw new Error("Pick an album");
    return {
      album_id,
      title: required(raw.title, "Title", 120),
      athlete: text(raw.athlete, 80),
      discipline: text(raw.discipline, 20),
      caption: text(raw.caption, 400),
      poster: dataUrl(raw.poster, "Cover", 350_000, "image"),
      video_url: httpUrl(raw.video_url),
      file: dataUrl(raw.file, "Clip", 2_400_000, "video"),
    };
  })
  .handler(async ({ context, data }) => {
    await requireMember(context.userId);
    if (!data.file && !data.video_url) throw new Error("Paste a link or choose a short clip");
    await assertAlbum(data.album_id);
    const sql = await getSql();
    const inserted = await sql<{ id: number }>`
      insert into gallery_items
        (album_id, kind, title, athlete, discipline, caption, poster, video_url, is_sample, added_by)
      values
        (${data.album_id}, 'video', ${data.title}, ${data.athlete}, ${data.discipline}, ${data.caption}, ${data.poster}, ${data.file ? "" : data.video_url}, false, ${context.userId})
      returning id
    `;
    const id = asNum(inserted[0]?.id);
    if (!id) throw new Error("Could not save that video");
    if (!data.file) return { id };
    try {
      await sql`insert into gallery_blobs (item_id, data) values (${id}, ${data.file})`;
    } catch (error) {
      await sql`delete from gallery_items where id = ${id}`;
      throw error;
    }
    return { id };
  });

export const updateGalleryItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = obj(input);
    const album_id = asNum(raw.album_id);
    if (!Number.isInteger(album_id) || album_id <= 0) throw new Error("Pick an album");
    return {
      id: idOf(raw),
      album_id,
      title: required(raw.title, "Title", 120),
      athlete: text(raw.athlete, 80),
      discipline: text(raw.discipline, 20),
      caption: text(raw.caption, 400),
      video_url: raw.video_url == null ? null : httpUrl(raw.video_url),
    };
  })
  .handler(async ({ context, data }) => {
    const role = await requireMember(context.userId);
    const item = await loadItem(data.id);
    if (!item) throw new Error("That item is gone");
    if (!canEdit(role, context.userId, item)) throw new Error("You can only change what you added");
    await assertAlbum(data.album_id);
    const sql = await getSql();
    const nextUrl = item.kind === "video" && !asBool(item.has_file) ? (data.video_url ?? item.video_url) : item.video_url;
    if (item.kind === "video" && !asBool(item.has_file) && !nextUrl) throw new Error("Paste the video link");
    await sql`
      update gallery_items set
        album_id = ${data.album_id},
        title = ${data.title},
        athlete = ${data.athlete},
        discipline = ${data.discipline},
        caption = ${data.caption},
        video_url = ${nextUrl}
      where id = ${data.id}
    `;
    return { ok: true };
  });

export const deleteGalleryItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(idOf)
  .handler(async ({ context, data }) => {
    const role = await requireMember(context.userId);
    const item = await loadItem(data);
    if (!item) return { ok: true };
    if (!canEdit(role, context.userId, item)) throw new Error("You can only remove what you added");
    const sql = await getSql();
    await sql`delete from gallery_items where id = ${data}`;
    return { ok: true };
  });

export const upsertGalleryAlbum = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = obj(input);
    const id = raw.id == null || raw.id === "" ? null : asNum(raw.id);
    if (id != null && (!Number.isInteger(id) || id <= 0)) throw new Error("Missing album");
    return {
      id,
      title: required(raw.title, "Album name", 120),
      event_date: dateOrEmpty(raw.event_date),
      notes: text(raw.notes, 400),
    };
  })
  .handler(async ({ context, data }) => {
    await requireInstructor(context.userId);
    const sql = await getSql();
    const eventDate = data.event_date || null;
    if (data.id) {
      await sql`
        update gallery_albums set
          title = ${data.title},
          event_date = ${eventDate},
          notes = ${data.notes}
        where id = ${data.id}
      `;
      return { id: data.id };
    }
    const inserted = await sql<{ id: number }>`
      insert into gallery_albums (title, event_date, notes, is_sample)
      values (${data.title}, ${eventDate}, ${data.notes}, false)
      returning id
    `;
    return { id: asNum(inserted[0]?.id) };
  });

export const deleteGalleryAlbum = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(idOf)
  .handler(async ({ context, data }) => {
    await requireInstructor(context.userId);
    const sql = await getSql();
    await sql`delete from gallery_albums where id = ${data}`;
    return { ok: true };
  });
