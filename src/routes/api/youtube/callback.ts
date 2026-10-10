import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";
import { YOUTUBE_STATE_COOKIE, exchangeCode, myChannel, revokeToken, sealToken, siteOrigin } from "@/lib/youtube.server";

function cookie(request: Request, name: string): string {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

function sameState(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Back from Google: store the channel grant and send the owner to Film. */
export const Route = createFileRoute("/api/youtube/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const done = (result: string) =>
          new Response(null, {
            status: 302,
            headers: {
              location: `${siteOrigin(request)}/app?section=film&youtube=${result}`,
              "set-cookie": `${YOUTUBE_STATE_COOKIE}=; Path=/api/youtube; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
              "cache-control": "no-store",
            },
          });

        if (!sameState(url.searchParams.get("state") ?? "", cookie(request, YOUTUBE_STATE_COOKIE))) return done("expired");
        const code = url.searchParams.get("code");
        if (!code) return done("cancelled");

        const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
        const userId = session?.user?.id;
        if (!userId) return done("expired");
        const sql = await getSql();
        const rows = await sql<{ role: string }>`select role from dojo_members where user_id = ${userId} limit 1`;
        if (rows[0]?.role !== "owner") return done("denied");

        try {
          const tokens = await exchangeCode(request, code);
          const channel = await myChannel(tokens.access);
          if (!channel) {
            await revokeToken(tokens.refresh);
            return done("nochannel");
          }
          await sql`
            update dojo_settings set
              youtube_token = ${sealToken(tokens.refresh)},
              youtube_account = ${channel.title},
              youtube_channel_id = ${channel.id},
              youtube_synced_at = null
            where id = 1
          `;
          return done("connected");
        } catch (error) {
          console.error("[youtube] connect failed:", error instanceof Error ? error.message : error);
          return done("failed");
        }
      },
    },
  },
});
