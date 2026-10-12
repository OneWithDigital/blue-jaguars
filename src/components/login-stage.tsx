import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, inLivePreview, signIn, signInWithGoogle } from "@/lib/auth/client";
import { errText } from "@/components/boot";
import { readJoinCode } from "@/lib/join-code";
import { getSiteOptions } from "@/lib/site-api";

type Mode = "up" | "in" | "forgot";

const input = "w-full rounded-lg border border-line bg-ink px-3 py-3 text-paper";

export function LoginStage() {
  // Off the Grok preview only Google works (X has no app of our own yet).
  const [preview, setPreview] = useState(false);
  const [joining, setJoining] = useState(false);
  const [mode, setMode] = useState<Mode>("in");
  useEffect(() => {
    setPreview(inLivePreview());
    const viaLink = Boolean(readJoinCode());
    let wantsSignup = false;
    let returning = false;
    try {
      wantsSignup = sessionStorage.getItem("bj-signup") === "1";
      returning = localStorage.getItem("bj-has-account") === "1";
    } catch {
      // storage unavailable
    }
    setJoining(viaLink);
    // First visit on this browser opens on Create account; returning families on Sign in.
    if (viaLink || wantsSignup || !returning) setMode("up");
  }, []);
  const options = useQuery({ queryKey: ["site-options"], queryFn: () => getSiteOptions(), staleTime: Infinity });
  const providers = GROK_PROVIDERS.filter((provider) => preview || provider.providerId === "grok-google");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  function pick(next: Mode) {
    setMode(next);
    setError("");
    setNotice("");
  }

  async function onProvider(providerId: string) {
    setError("");
    setBusy(true);
    try {
      localStorage.setItem("bj-has-account", "1");
    } catch {
      // storage unavailable
    }
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
    setNotice("");
    setBusy(true);
    try {
      if (mode === "forgot") {
        const sent = await authClient.requestPasswordReset({ email, redirectTo: "/reset" });
        if (sent.error) throw new Error(sent.error.message ?? "Could not send the reset email");
        setNotice("If that email has an account here, a reset link is on its way. Check your inbox and spam folder.");
        setBusy(false);
        return;
      }
      if (mode === "up") {
        const created = await authClient.signUp.email({ email, password, name });
        if (created.error) throw new Error(created.error.message ?? "Could not create the account");
      } else {
        const signed = await authClient.signIn.email({ email, password });
        if (signed.error) throw new Error(signed.error.message ?? "Could not sign in");
      }
      try {
        localStorage.setItem("bj-has-account", "1");
      } catch {
        // storage unavailable
      }
      window.location.assign("/");
    } catch (cause) {
      const message = errText(cause);
      setError(
        /invalid email or password/i.test(message)
          ? "That email and password don't match. New here? Choose Create account."
          : /already exists/i.test(message)
            ? "That email already has an account. Choose Sign in."
            : message,
      );
      setBusy(false);
    }
  }

  const tab = (value: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === value}
      onClick={() => pick(value)}
      className={
        "min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold " + (mode === value ? "bg-blue text-ink" : "text-mute")
      }
    >
      {label}
    </button>
  );

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
          <h1 className="mt-2 font-display text-4xl leading-none tracking-wide sm:text-5xl">
            {joining ? "Welcome to the team" : "Sports Karate"}
          </h1>
          <p className="mt-3 text-mute">
            {joining
              ? "Create your family account. Your team code is already saved, so you go straight in."
              : "The team room for Blue Jaguars families and instructors. New family? Create an account, then enter the team code from your coach."}
          </p>
          {authEnabled ? (
            <div className="mt-6 space-y-3">
              {providers.map((provider) => (
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
              <p className="text-center text-xs tracking-[0.14em] text-mute uppercase">or use your email</p>
              <form onSubmit={(event) => void onEmail(event)} className="space-y-3 rounded-xl border border-line bg-panel/90 p-4">
                {mode === "forgot" ? (
                  <div>
                    <p className="font-semibold">Reset your password</p>
                    <p className="mt-1 text-sm text-mute">
                      {options.data?.passwordReset
                        ? "Enter the email you signed up with and we'll send a link to choose a new password."
                        : "Password reset by email isn't turned on yet. Ask your coach for help, or use Continue with Google if you signed up with Google."}
                    </p>
                  </div>
                ) : (
                  <div role="tablist" aria-label="Account" className="flex gap-1 rounded-xl border border-line p-1">
                    {tab("up", "Create account")}
                    {tab("in", "Sign in")}
                  </div>
                )}
                {mode === "up" ? (
                  <label className="block text-sm">
                    <span className="mb-1 block text-mute">Your name (parent or guardian)</span>
                    <input
                      required
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className={input}
                      autoComplete="name"
                    />
                  </label>
                ) : null}
                {mode !== "forgot" || options.data?.passwordReset ? (
                  <label className="block text-sm">
                    <span className="mb-1 block text-mute">Email</span>
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className={input}
                      autoComplete="email"
                    />
                  </label>
                ) : null}
                {mode !== "forgot" ? (
                  <label className="block text-sm">
                    <span className="mb-1 block text-mute">{mode === "up" ? "Choose a password (at least 8 characters)" : "Password"}</span>
                    <input
                      required
                      minLength={8}
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className={input}
                      autoComplete={mode === "up" ? "new-password" : "current-password"}
                    />
                  </label>
                ) : null}
                {mode !== "forgot" || options.data?.passwordReset ? (
                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-11 w-full rounded-lg bg-blue px-4 py-3 font-semibold text-ink disabled:opacity-60"
                  >
                    {busy ? "One moment…" : mode === "up" ? "Create account" : mode === "in" ? "Sign in" : "Send reset link"}
                  </button>
                ) : null}
                {mode === "in" ? (
                  <button type="button" onClick={() => pick("forgot")} className="min-h-11 text-sm text-mute underline-offset-4 hover:underline">
                    Forgot password?
                  </button>
                ) : null}
                {mode === "forgot" ? (
                  <button type="button" onClick={() => pick("in")} className="min-h-11 text-sm text-mute underline-offset-4 hover:underline">
                    Back to sign in
                  </button>
                ) : null}
              </form>
              {error ? <p className="text-sm text-gold">{error}</p> : null}
              {notice ? <p className="text-sm text-paper">{notice}</p> : null}
              <a href="/privacy" className="block text-sm text-mute underline-offset-4 hover:underline">
                Privacy
              </a>
            </div>
          ) : (
            <p className="mt-6 text-sm text-mute">Sign-in is not turned on.</p>
          )}
        </div>
      </div>
    </main>
  );
}
