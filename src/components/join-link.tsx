import QRCode from "qrcode";
import { useEffect, useState } from "react";

/**
 * Owner-only Desk card: a join link and QR code that carry the parent code, so
 * a new family signs up and lands on the team without typing anything.
 */
export function JoinLinkCard({ memberCode, teamName }: { memberCode: string; teamName: string }) {
  const [origin, setOrigin] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  const link = origin && memberCode ? `${origin}/join?code=${encodeURIComponent(memberCode)}` : "";

  useEffect(() => {
    if (!link) return;
    let live = true;
    QRCode.toDataURL(link, { width: 640, margin: 2, errorCorrectionLevel: "M", color: { dark: "#06101f", light: "#ffffff" } })
      .then((url) => {
        if (live) setQr(url);
      })
      .catch(() => setQr(""));
    return () => {
      live = false;
    };
  }, [link]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (!memberCode) return null;
  return (
    <section className="rounded-2xl border border-line bg-panel px-4 py-4">
      <h2 className="font-display text-3xl tracking-wide">Invite families</h2>
      <p className="mt-1 max-w-2xl text-sm text-mute">
        Send this link or print the QR code for the dojo wall. Families create an account and land on the team with the parent
        code already filled in. If you change the parent code, old links and printed codes stop working.
      </p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        {qr ? (
          <img src={qr} alt={`QR code to join ${teamName}`} className="size-40 shrink-0 rounded-xl bg-white p-1" />
        ) : (
          <span className="grid size-40 shrink-0 place-items-center rounded-xl border border-line text-sm text-mute">QR code</span>
        )}
        <div className="min-w-0 flex-1 space-y-3">
          <p className="rounded-lg border border-line bg-ink px-3 py-3 font-mono text-sm break-all">{link || "…"}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void copy()} className="min-h-11 rounded-full bg-blue px-4 text-sm font-semibold text-ink">
              {copied ? "Copied" : "Copy link"}
            </button>
            {qr ? (
              <a
                href={qr}
                download="blue-jaguars-join-qr.png"
                className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm"
              >
                Download QR code
              </a>
            ) : null}
            <a
              href={`sms:?&body=${encodeURIComponent(`Join the ${teamName} team room: ${link}`)}`}
              className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm"
            >
              Text it
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
