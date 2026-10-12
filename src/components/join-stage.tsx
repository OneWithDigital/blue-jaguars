import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UserButton } from "@/lib/auth/gates";
import { joinDojo } from "@/lib/dojo-api";
import { errText } from "@/components/boot";
import { forgetJoinCode, readJoinCode } from "@/lib/join-code";

export function JoinStage() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fromLink, setFromLink] = useState(false);
  const tried = useRef(false);

  async function join(value: string, viaLink: boolean) {
    setBusy(true);
    setError("");
    try {
      await joinDojo({ data: { code: value } });
      forgetJoinCode();
      await queryClient.invalidateQueries({ queryKey: ["membership"] });
    } catch (cause) {
      const message = errText(cause);
      if (viaLink && /does not match/i.test(message)) {
        forgetJoinCode();
        setError("That join link has an old team code. Ask your coach for the current code and type it here.");
        setCode("");
      } else {
        setError(message);
      }
      setBusy(false);
    }
  }

  // Came from a join link: fill the code and go straight in.
  useEffect(() => {
    if (tried.current) return;
    tried.current = true;
    const saved = readJoinCode();
    if (!saved) return;
    setFromLink(true);
    setCode(saved);
    void join(saved, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void join(code, false);
  }

  return (
    <main className="relative min-h-screen bg-ink text-paper">
      <img src="/media/jaguar-still.jpg?v=tornado" alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
      <div className="absolute inset-0 bg-ink/75" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-10">
        <div className="mb-8 flex justify-end">
          <UserButton />
        </div>
        <p className="font-display text-sm tracking-[0.35em] text-gold">STEP 2 OF 2</p>
        <h1 className="mt-2 font-display text-5xl leading-none tracking-wide">
          {fromLink && busy ? "Joining the team…" : "Enter your team code"}
        </h1>
        <p className="mt-3 text-mute">
          Your coach gives each family the team code, or a join link that fills it in for you. You only enter it once.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
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
            {busy ? "Checking…" : "Join the team"}
          </button>
          {error ? <p className="text-sm text-gold">{error}</p> : null}
        </form>
      </div>
    </main>
  );
}
