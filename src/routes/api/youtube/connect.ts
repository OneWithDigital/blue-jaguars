import { createFileRoute } from "@tanstack/react-router";
import { randomBytes } from "node:crypto";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";
import { YOUTUBE_STATE_COOKIE, authorizeUrl, googleClient } from "@/lib/youtube.server";

/** Owner only: send them to Google to let the site read the club channel. */
export const Route = createFileRoute("/api/youtube/connect")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
        const userId = session?.user?.id;
        if (!userId) return Response.redirect(new URL("/login", request.url), 302);
        const sql = await getSql();
        const rows = await sql<{ role: string }>`select role from dojo_members where user_id = ${userId} limit 1`;
        if (rows[0]?.role !== "owner") return new Response("Only the owner can connect YouTube.", { status: 403 });
        if (!googleClient()) return new Response("Google sign-in is not configured on this server.", { status: 500 });
        const state = randomBytes(24).toString("base64url");
        return new Response(null, {
          status: 302,
          headers: {
            location: authorizeUrl(request, state),
            "set-cookie": `${YOUTUBE_STATE_COOKIE}=${state}; Path=/api/youtube; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
