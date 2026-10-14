import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { receiptFor } from "@/lib/books-api";

/** Receipt photo for an expense. Owner only. */
export const Route = createFileRoute("/api/expense-receipt/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const id = Number(params.id);
        if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });
        const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
        const userId = session?.user?.id;
        if (!userId) return new Response("Sign in first", { status: 401 });
        const data = await receiptFor(userId, id);
        const match = data?.match(/^data:(image\/jpeg);base64,(.+)$/);
        if (!match) return new Response("Not found", { status: 404 });
        return new Response(Buffer.from(match[2], "base64"), {
          headers: {
            "content-type": match[1],
            "cache-control": "private, no-store",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
