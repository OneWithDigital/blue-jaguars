import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth/client";
import { errText } from "@/components/boot";

export const Route = createFileRoute("/reset")({
  validateSearch: (search: Record<string, unknown>): { token?: string; error?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: ResetPage,
});

const field = "w-full rounded-lg border border-line bg-ink px-3 py-3 text-paper";

function ResetPage() {
  const { token, error: linkError } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== again) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token: token ?? "" });
      if (result.error) {
        const message = result.error.message ?? "";
        throw new Error(
          /token/i.test(message)
            ? "This reset link has expired or was already used. Ask for a new one from the sign-in screen."
            : message || "Could not reset the password",
        );
      }
      setDone(true);
    } catch (cause) {
      setError(errText(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-ink px-5 py-10 text-paper">
      <div className="w-full max-w-sm">
        <p className="font-display text-sm tracking-[0.35em] text-gold">BLUE JAGUARS</p>
        <h1 className="mt-2 font-display text-4xl leading-none tracking-wide">Choose a new password</h1>
        {done ? (
          <div className="mt-6 space-y-4">
            <p className="text-mute">Your password is updated. Sign in with the new one.</p>
            <a href="/login" className="block min-h-11 w-full rounded-lg bg-blue px-4 py-3 text-center font-semibold text-ink">
              Go to sign in
            </a>
          </div>
        ) : !token || linkError ? (
          <div className="mt-6 space-y-4">
            <p className="text-mute">This reset link has expired or was already used. Ask for a new one from the sign-in screen.</p>
            <a href="/login" className="block min-h-11 w-full rounded-lg bg-blue px-4 py-3 text-center font-semibold text-ink">
              Back to sign in
            </a>
          </div>
        ) : (
          <form onSubmit={(event) => void onSubmit(event)} className="mt-6 space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-mute">New password (at least 8 characters)</span>
              <input
                required
                minLength={8}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={field}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-mute">Type it again</span>
              <input
                required
                minLength={8}
                type="password"
                autoComplete="new-password"
                value={again}
                onChange={(event) => setAgain(event.target.value)}
                className={field}
              />
            </label>
            <button type="submit" disabled={busy} className="min-h-11 w-full rounded-lg bg-blue px-4 py-3 font-semibold text-ink disabled:opacity-60">
              {busy ? "Saving…" : "Save new password"}
            </button>
            {error ? <p className="text-sm text-gold">{error}</p> : null}
          </form>
        )}
      </div>
    </main>
  );
}
