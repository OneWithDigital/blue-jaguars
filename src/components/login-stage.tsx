import { useState, type FormEvent } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn, signInWithGoogle } from "@/lib/auth/client";
import { errText } from "@/components/boot";

export function LoginStage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onProvider(providerId: string) {
    setError("");
    setBusy(true);
    try {
      await (providerId === "grok-google" ? signInWithGoogle("/") : signIn(providerId, { callbackURL: "/" }));
    } catch (cause) {
      setError(errText(cause));
      setBusy(false);
    }
  }

  async function onEmail(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "up") {
        const created = await authClient.signUp.email({ email, password, name });
        if (created.error) throw new Error(created.error.message ?? "Could not create the account");
      } else {
        const signed = await authClient.signIn.email({ email, password });
        if (signed.error) throw new Error(signed.error.message ?? "Could not sign in");
      }
      window.location.assign("/");
    } catch (cause) {
      setError(errText(cause));
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-ink text-paper">
      <img
        src="/media/jaguar-still.jpg?v=tornado"
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-80"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/88 to-ink/35" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col justify-end px-5 py-10 sm:justify-center sm:px-10">
        <div className="max-w-md">
          <p className="font-display text-sm tracking-[0.35em] text-gold">BLUE JAGUARS</p>
          <h1 className="mt-2 font-display text-4xl leading-none tracking-wide sm:text-5xl">Sports Karate</h1>
          <p className="mt-3 text-mute">
            Parents and instructors sign in here. The roster, phone tree, and circuit card stay inside.
          </p>
          {authEnabled ? (
            <div className="mt-6 space-y-3">
              {GROK_PROVIDERS.map((provider) => (
                <button
                  key={provider.providerId}
                  type="button"
                  disabled={busy}
                  onClick={() => void onProvider(provider.providerId)}
                  className="flex min-h-11 w-full items-center justify-between rounded-xl border border-line bg-panel/90 px-4 py-3 text-left text-paper disabled:opacity-60"
                >
                  <span>Continue with {provider.label}</span>
                  <span className="font-display text-gold">{provider.label === "X" ? "X" : "G"}</span>
                </button>
              ))}
              <form onSubmit={(event) => void onEmail(event)} className="space-y-3 rounded-xl border border-line bg-panel/90 p-4">
                <div className="flex gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => setMode("in")}
                    className={mode === "in" ? "text-gold" : "text-mute"}
                  >
                    Sign in
                  </button>
                  <span className="text-line">/</span>
                  <button
                    type="button"
                    onClick={() => setMode("up")}
                    className={mode === "up" ? "text-gold" : "text-mute"}
                  >
                    Create account
                  </button>
                </div>
                {mode === "up" ? (
                  <label className="block text-sm">
                    <span className="mb-1 block text-mute">Your name</span>
                    <input
                      required
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="w-full rounded-lg border border-line bg-ink px-3 py-3 text-paper"
                      autoComplete="name"
                    />
                  </label>
                ) : null}
                <label className="block text-sm">
                  <span className="mb-1 block text-mute">Email</span>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-lg border border-line bg-ink px-3 py-3 text-paper"
                    autoComplete="email"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-mute">Password</span>
                  <input
                    required
                    minLength={8}
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-lg border border-line bg-ink px-3 py-3 text-paper"
                    autoComplete={mode === "up" ? "new-password" : "current-password"}
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-11 w-full rounded-lg bg-blue px-4 py-3 font-semibold text-ink disabled:opacity-60"
                >
                  {busy ? "One moment…" : mode === "up" ? "Create account" : "Sign in"}
                </button>
              </form>
              {error ? <p className="text-sm text-gold">{error}</p> : null}
              <button
                type="button"
                className="text-sm text-mute underline-offset-4 hover:underline"
                onClick={() => {
                  sessionStorage.removeItem("bj-intro");
                  window.location.assign("/");
                }}
              >
                Replay the intro
              </button>
            </div>
          ) : (
            <p className="mt-6 text-sm text-mute">Sign-in is not turned on.</p>
          )}
        </div>
      </div>
    </main>
  );
}
