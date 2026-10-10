import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env.server";

/**
 * Server-only helpers for reading the club channel through the YouTube Data API
 * with the owner's Google sign-in. This is what lets unlisted videos come in;
 * the public RSS feed only lists public ones.
 */

export const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
export const YOUTUBE_STATE_COOKIE = "bj_yt_state";
const CALLBACK_PATH = "/api/youtube/callback";

export function googleClient(): { id: string; secret: string } | null {
  const id = env("GOOGLE_CLIENT_ID");
  const secret = env("GOOGLE_CLIENT_SECRET");
  return id && secret ? { id, secret } : null;
}

/** Public origin of the site. Prefer the configured URL over request headers. */
export function siteOrigin(request: Request): string {
  const configured = env("BETTER_AUTH_URL");
  if (configured) return new URL(configured).origin;
  return new URL(request.url).origin;
}

export function callbackUrl(request: Request): string {
  return `${siteOrigin(request)}${CALLBACK_PATH}`;
}

// ---------- token encryption (AES-256-GCM keyed from the auth secret) ----------

function key(): Buffer {
  const secret = env("BETTER_AUTH_SECRET");
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
  return createHash("sha256").update(`youtube:${secret}`).digest();
}

export function sealToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

export function openToken(sealed: string): string | null {
  const [version, iv, tagPart, body] = sealed.split(".");
  if (version !== "v1" || !iv || !tagPart || !body) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// ---------- OAuth ----------

export function authorizeUrl(request: Request, state: string): string {
  const client = googleClient();
  if (!client) throw new Error("Google sign-in is not configured");
  const params = new URLSearchParams({
    client_id: client.id,
    redirect_uri: callbackUrl(request),
    response_type: "code",
    scope: YOUTUBE_SCOPE,
    access_type: "offline",
    prompt: "consent select_account",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

type TokenResponse = { access_token?: string; refresh_token?: string; error?: string; error_description?: string };

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(8000),
  });
  return (await res.json().catch(() => ({}))) as TokenResponse;
}

export async function exchangeCode(request: Request, code: string): Promise<{ access: string; refresh: string }> {
  const client = googleClient();
  if (!client) throw new Error("Google sign-in is not configured");
  const json = await tokenRequest({
    code,
    client_id: client.id,
    client_secret: client.secret,
    redirect_uri: callbackUrl(request),
    grant_type: "authorization_code",
  });
  if (!json.access_token || !json.refresh_token) {
    throw new Error(json.error_description || json.error || "Google did not return a token");
  }
  return { access: json.access_token, refresh: json.refresh_token };
}

/** Thrown when Google says the stored grant is gone (revoked or expired). */
export class YouTubeReconnect extends Error {}

export async function accessFromRefresh(refresh: string): Promise<string> {
  const client = googleClient();
  if (!client) throw new Error("Google sign-in is not configured");
  const json = await tokenRequest({
    refresh_token: refresh,
    client_id: client.id,
    client_secret: client.secret,
    grant_type: "refresh_token",
  });
  if (json.error === "invalid_grant") throw new YouTubeReconnect("YouTube access was removed");
  if (!json.access_token) throw new Error(json.error_description || json.error || "Google did not return a token");
  return json.access_token;
}

export async function revokeToken(refresh: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh)}`, {
    method: "POST",
    signal: AbortSignal.timeout(6000),
  }).catch(() => undefined);
}

// ---------- Data API ----------

async function api<T>(access: string, path: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams(params)}`, {
    headers: { authorization: `Bearer ${access}` },
    signal: AbortSignal.timeout(8000),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) {
    if (res.status === 401) throw new YouTubeReconnect("YouTube access was removed");
    throw new Error(json.error?.message || `YouTube answered ${res.status}`);
  }
  return json;
}

export type ChannelInfo = { id: string; title: string; uploads: string };

export async function myChannel(access: string): Promise<ChannelInfo | null> {
  const json = await api<{
    items?: { id: string; snippet?: { title?: string }; contentDetails?: { relatedPlaylists?: { uploads?: string } } }[];
  }>(access, "channels", { part: "snippet,contentDetails", mine: "true" });
  const item = json.items?.[0];
  const uploads = item?.contentDetails?.relatedPlaylists?.uploads;
  if (!item || !uploads) return null;
  return { id: item.id, title: item.snippet?.title ?? "", uploads };
}

export type ChannelVideo = {
  id: string;
  title: string;
  description: string;
  published: string;
  privacy: "public" | "unlisted" | "private";
};

/** Newest uploads (up to `limit`), with each video's privacy setting. */
export async function channelVideos(access: string, uploads: string, limit = 200): Promise<ChannelVideo[]> {
  const ids: string[] = [];
  let pageToken = "";
  while (ids.length < limit) {
    const page = await api<{ items?: { contentDetails?: { videoId?: string } }[]; nextPageToken?: string }>(
      access,
      "playlistItems",
      { part: "contentDetails", playlistId: uploads, maxResults: "50", ...(pageToken ? { pageToken } : {}) },
    );
    for (const item of page.items ?? []) {
      const id = item.contentDetails?.videoId;
      if (id && /^[A-Za-z0-9_-]{6,20}$/.test(id)) ids.push(id);
    }
    if (!page.nextPageToken) break;
    pageToken = page.nextPageToken;
  }
  const videos: ChannelVideo[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = await api<{
      items?: {
        id: string;
        snippet?: { title?: string; description?: string; publishedAt?: string };
        status?: { privacyStatus?: string; uploadStatus?: string };
      }[];
    }>(access, "videos", { part: "snippet,status", id: ids.slice(i, i + 50).join(","), maxResults: "50" });
    for (const item of batch.items ?? []) {
      const status = item.status?.privacyStatus;
      const privacy = status === "public" || status === "unlisted" ? status : "private";
      // Skip uploads that are still processing or failed.
      if (item.status?.uploadStatus && item.status.uploadStatus !== "processed") continue;
      videos.push({
        id: item.id,
        title: (item.snippet?.title ?? "").slice(0, 120) || "Club video",
        description: (item.snippet?.description ?? "").slice(0, 400),
        published: item.snippet?.publishedAt ?? "",
        privacy,
      });
    }
  }
  return videos;
}
