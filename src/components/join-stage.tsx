import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UserButton } from "@/lib/auth/gates";
import { joinDojo } from "@/lib/dojo-api";
import { errText } from "@/components/boot";

export function JoinStage() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await joinDojo({ data: { code } });
      await queryClient.invalidateQueries({ queryKey: ["membership"] });
    } catch (cause) {
      setError(errText(cause));
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen bg-ink text-paper">
      <img src="/media/jaguar-still.jpg?v=tornado" alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
      <div className="absolute inset-0 bg-ink/75" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-10">
        <div className="mb-8 flex justify-end">
          <UserButton />
        </div>
        <p className="font-display text-sm tracking-[0.35em] text-gold">TEAM CODE</p>
        <h1 className="mt-2 font-display text-5xl leading-none tracking-wide">You’re signed in. Not on the mat yet.</h1>
        <p className="mt-3 text-mute">
          Ask a coach for the parent code, or use the instructor code if you run the desk. You only enter it once on this account.
        </p>
        <form onSubmit={(event) => void onSubmit(event)} className="mt-6 space-y-3">
          <label className="block">
            <span className="sr-only">Team code</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              required
              minLength={4}
              className="w-full rounded-xl border border-line bg-panel px-4 py-4 font-display text-3xl tracking-[0.25em] text-paper uppercase"
              placeholder="CODE"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 w-full rounded-xl bg-blue px-4 py-3 font-semibold text-ink disabled:opacity-60"
          >
            {busy ? "Checking…" : "Unlock the team room"}
          </button>
          {error ? <p className="text-sm text-gold">{error}</p> : null}
        </form>
      </div>
    </main>
  );
}
