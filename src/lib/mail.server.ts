import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env.server";

/**
 * Outgoing email (server only). Configured entirely by environment so no
 * credentials live in the repo:
 *
 *   SMTP_HOST   e.g. smtp-relay.brevo.com
 *   SMTP_PORT   587 (STARTTLS) or 465 (TLS)
 *   SMTP_USER   SMTP login
 *   SMTP_PASS   SMTP key / password
 *   MAIL_FROM   e.g. "Blue Jaguars <noreply@bluejaguarskarate.com>"
 *
 * When any of these are missing, mailConfigured is false and features that
 * need email (password reset) stay hidden.
 */
export function mailConfigured(): boolean {
  return Boolean(env("SMTP_HOST") && env("SMTP_USER") && env("SMTP_PASS") && env("MAIL_FROM"));
}

let transport: Transporter | null = null;

function transporter(): Transporter {
  if (transport) return transport;
  const port = Number(env("SMTP_PORT") ?? "587");
  transport = nodemailer.createTransport({
    host: env("SMTP_HOST"),
    port,
    secure: port === 465,
    auth: { user: env("SMTP_USER"), pass: env("SMTP_PASS") },
  });
  return transport;
}

export async function sendMail(message: {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}): Promise<void> {
  if (!mailConfigured()) throw new Error("Email is not set up on this server");
  await transporter().sendMail({ from: env("MAIL_FROM"), ...message });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);
}

export async function sendPasswordReset(to: string, name: string, url: string): Promise<void> {
  const hello = name ? `Hi ${name},` : "Hi,";
  await sendMail({
    to,
    subject: "Reset your Blue Jaguars password",
    text: `${hello}\n\nSomeone asked to reset the password for your Blue Jaguars team room account. Open this link to choose a new one. It works for one hour.\n\n${url}\n\nIf you did not ask for this, you can ignore this email. Your password stays the same.\n\nBlue Jaguars Sports Karate`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#111;max-width:480px">
<p>${escapeHtml(hello)}</p>
<p>Someone asked to reset the password for your Blue Jaguars team room account. Use the button below to choose a new one. It works for one hour.</p>
<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#3c8dff;color:#06101f;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:8px">Choose a new password</a></p>
<p style="color:#555;font-size:14px">If you did not ask for this, you can ignore this email. Your password stays the same.</p>
<p style="color:#555;font-size:14px">Blue Jaguars Sports Karate</p>
</div>`,
  });
}

const KIND_NAME: Record<string, string> = { idea: "Idea", problem: "Problem", other: "Other" };

/**
 * Tell the site owner a family sent feedback. The subject always starts with
 * "[Blue Jaguars feedback]" so it can be filtered and picked up for updates.
 */
export async function sendFeedbackNotice(to: string, note: {
  kind: string;
  page: string;
  message: string;
  name: string;
  email: string;
}): Promise<void> {
  const kind = KIND_NAME[note.kind] ?? "Note";
  const where = note.page ? ` · ${note.page}` : "";
  const who = [note.name, note.email].filter(Boolean).join(" · ") || "A team member";
  await sendMail({
    to,
    replyTo: note.email || undefined,
    subject: `[Blue Jaguars feedback] ${kind}${where}`,
    text: `${kind}${where}\nFrom: ${who}\n\n${note.message}\n\nSee all notes on the Desk: https://bluejaguarskarate.com/app?section=desk`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#111;max-width:560px">
<p style="margin:0 0 4px;color:#555;font-size:13px;text-transform:uppercase;letter-spacing:.08em">${escapeHtml(kind + where)}</p>
<p style="margin:0 0 16px;color:#555;font-size:14px">From ${escapeHtml(who)}</p>
<p style="white-space:pre-wrap;margin:0 0 20px">${escapeHtml(note.message)}</p>
<p style="font-size:14px"><a href="https://bluejaguarskarate.com/app?section=desk">See all notes on the Desk</a></p>
</div>`,
  });
}
