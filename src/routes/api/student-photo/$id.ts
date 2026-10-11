import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { studentPhotoFor } from "@/lib/dojo-api";

/** Athlete photo for the roster. Signed-in team members only. */
export const Route = createFileRoute("/api/student-photo/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const id = Number(params.id);
        if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });
        const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
        const userId = session?.user?.id;
        if (!userId) return new Response("Sign in first", { status: 401 });
        const photo = await studentPhotoFor(userId, id);
        if (!photo) return new Response("Not found", { status: 404 });
        const match = photo.match(/^data:(image\/jpeg);base64,(.+)$/);
        if (!match) return new Response("Not found", { status: 404 });
        return new Response(Buffer.from(match[2], "base64"), {
          headers: {
            "content-type": match[1],
            // The roster links with ?v=<photo_version>, so a new photo gets a new URL.
            "cache-control": "private, max-age=604800",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
