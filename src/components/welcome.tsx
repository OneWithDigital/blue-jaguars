import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  CircleHelp,
  LayoutGrid,
  MessageSquarePlus,
  Trophy,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { errText } from "@/components/boot";
import { finishTour, resolveFeedback, sendFeedback, type FeedbackRow } from "@/lib/dojo-api";
import type { Section } from "@/lib/dojo";

const field =
  "w-full rounded-lg border border-line bg-ink px-3 py-3 text-base text-paper outline-none focus:border-blue";

type Step = {
  icon: LucideIcon;
  kicker: string;
  title: string;
  body: string;
  action?: { label: string; kind: "roster" | "feedback" };
};

const STEPS: Step[] = [
  {
    icon: LayoutGrid,
    kicker: "Welcome",
    title: "This is the team room",
    body: "Blue Jaguars keeps class times, tournaments, results, and team film here. Families and instructors share it, and only signed-in team members can see it. Setup takes about a minute.",
  },
  {
    icon: UserPlus,
    kicker: "Step 1",
    title: "Add your athlete",
    body: "Open Roster and tap Add my athlete. Fill in belt, age, events, and weapon, and add a photo so teammates and instructors learn names. Only you and the instructors can change your athlete's card.",
    action: { label: "Add my athlete now", kind: "roster" },
  },
  {
    icon: CalendarDays,
    kicker: "Step 2",
    title: "Check the calendar",
    body: "Calendar shows classes week by week. Under This week, mark who is coming so instructors can plan the floor. You will also see when it is your family's week to clean.",
  },
  {
    icon: Trophy,
    kicker: "Step 3",
    title: "Follow the season",
    body: "Events lists upcoming tournaments. MSKC shows circuit standings and medals. Film has photos and fight video, including new videos from the club YouTube channel. Post team news on the Board.",
  },
  {
    icon: MessageSquarePlus,
    kicker: "Step 4",
    title: "Tell us what would help",
    body: "The Feedback button sits at the top of every page. Send an idea, tell us something is not working, or ask for a feature. Instructors read every note.",
    action: { label: "Send feedback now", kind: "feedback" },
  },
];

/** First-run walkthrough. Shows once per member; the Tour button replays it. */
export function WelcomeTour({
  open,
  onOpenChange,
  onFeedback,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFeedback: () => void;
}) {
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const done = useMutation({
    mutationFn: () => finishTour(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["portal"] }),
  });

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const close = () => {
    onOpenChange(false);
    if (!done.isSuccess) done.mutate();
  };
  const step = STEPS[index];
  const last = index === STEPS.length - 1;
  const Icon = step.icon;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/85" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-2xl border border-line bg-panel p-6 text-paper sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
          <div className="mb-5 flex items-center justify-between">
            <span className="grid size-12 place-items-center rounded-full bg-blue/15 text-blue">
              <Icon className="size-6" />
            </span>
            <Dialog.Close className="grid size-11 place-items-center rounded-lg border border-line" aria-label="Skip the tour">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <p className="text-xs tracking-[0.18em] text-gold uppercase">{step.kicker}</p>
          <Dialog.Title className="mt-1 font-display text-4xl leading-none tracking-wide">{step.title}</Dialog.Title>
          <Dialog.Description className="mt-3 text-base leading-relaxed text-mute">{step.body}</Dialog.Description>
          {step.action ? (
            <button
              type="button"
              className="mt-5 inline-flex min-h-11 items-center rounded-full border border-blue px-4 text-sm font-semibold text-blue"
              onClick={() => {
                close();
                if (step.action?.kind === "roster") void navigate({ to: "/app", search: { section: "roster" as Section } });
                else onFeedback();
              }}
            >
              {step.action.label}
            </button>
          ) : null}
          <div className="mt-6 flex items-center justify-between gap-3">
            <div className="flex gap-1.5" aria-label={`Step ${index + 1} of ${STEPS.length}`}>
              {STEPS.map((item, i) => (
                <span key={item.title} className={"h-1.5 rounded-full " + (i === index ? "w-6 bg-blue" : "w-1.5 bg-line")} />
              ))}
            </div>
            <div className="flex gap-2">
              {index > 0 ? (
                <button type="button" className="min-h-11 rounded-full border border-line px-4 text-sm" onClick={() => setIndex(index - 1)}>
                  Back
                </button>
              ) : null}
              <button
                type="button"
                className="min-h-11 rounded-full bg-blue px-5 text-sm font-semibold text-ink"
                onClick={() => (last ? close() : setIndex(index + 1))}
              >
                {last ? "Done" : "Next"}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function TourButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Take the tour"
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-3 text-sm text-mute"
    >
      <CircleHelp className="size-4" />
      <span className="hidden sm:inline">Tour</span>
    </button>
  );
}

export function FeedbackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Send feedback"
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gold/60 px-3 text-sm text-gold"
    >
      <MessageSquarePlus className="size-4" />
      <span className="hidden sm:inline">Feedback</span>
    </button>
  );
}

const KINDS: { id: "idea" | "problem" | "other"; label: string }[] = [
  { id: "idea", label: "Idea" },
  { id: "problem", label: "Something is not working" },
  { id: "other", label: "Other" },
];

export function FeedbackSheet({
  open,
  onOpenChange,
  page,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page: string;
}) {
  const [kind, setKind] = useState<"idea" | "problem" | "other">("idea");
  const [message, setMessage] = useState("");
  const send = useMutation({ mutationFn: () => sendFeedback({ data: { kind, message, page } }) });

  useEffect(() => {
    if (open) {
      send.reset();
      setMessage("");
      setKind("idea");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/80" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-2xl border border-line bg-panel p-5 text-paper sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-4xl leading-none tracking-wide">Feedback</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-mute">
                What would make the team room better? Instructors read every note.
              </Dialog.Description>
            </div>
            <Dialog.Close className="grid size-11 place-items-center rounded-lg border border-line" aria-label="Close">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          {send.isSuccess ? (
            <div className="rounded-xl border border-line px-4 py-4">
              <p className="text-lg">Thanks for the note.</p>
              <p className="mt-1 text-sm text-mute">It went straight to the instructors.</p>
              <button type="button" className="mt-4 min-h-11 rounded-full bg-blue px-5 text-sm font-semibold text-ink" onClick={() => onOpenChange(false)}>
                Close
              </button>
            </div>
          ) : (
            <form
              className="grid gap-3"
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                send.mutate();
              }}
            >
              <div className="flex flex-wrap gap-2">
                {KINDS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={kind === item.id}
                    onClick={() => setKind(item.id)}
                    className={"min-h-11 rounded-full px-4 text-sm " + (kind === item.id ? "bg-blue text-ink" : "border border-line text-mute")}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="mb-1 block text-xs tracking-[0.14em] text-mute uppercase">Your note</span>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={5}
                  maxLength={2000}
                  placeholder={kind === "problem" ? "What happened, and on which page?" : "Tell us what you would like to see."}
                  className={field}
                />
              </label>
              <button
                type="submit"
                disabled={send.isPending}
                className="min-h-11 rounded-lg bg-blue px-4 font-semibold text-ink disabled:opacity-60"
              >
                {send.isPending ? "Sending…" : "Send"}
              </button>
              {send.isError ? <p className="text-sm text-gold">{errText(send.error)}</p> : null}
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const KIND_LABEL: Record<FeedbackRow["kind"], string> = { idea: "Idea", problem: "Problem", other: "Other" };

/** Desk list of the notes families send from the Feedback button. */
export function FeedbackInbox({ rows }: { rows: FeedbackRow[] }) {
  const open = rows.filter((row) => !row.resolved);
  return (
    <section>
      <h2 className="mb-1 font-display text-3xl tracking-wide">Site feedback</h2>
      <p className="mb-3 max-w-2xl text-sm text-mute">
        Notes from the Feedback button. {open.length ? `${open.length} open.` : "Nothing open."}
      </p>
      {rows.length ? (
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {rows.map((row) => (
            <FeedbackItem key={row.id} row={row} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-mute">No feedback yet.</p>
      )}
    </section>
  );
}

function FeedbackItem({ row }: { row: FeedbackRow }) {
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: () => resolveFeedback({ data: { id: row.id, resolved: !row.resolved } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["portal"] }),
  });
  const when = new Date(row.created_at.replace(" ", "T"));
  return (
    <li className={"px-4 py-3 text-sm " + (row.resolved ? "opacity-60" : "")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs tracking-[0.14em] text-gold uppercase">
          {KIND_LABEL[row.kind]}
          {row.page ? ` · ${row.page}` : ""}
        </span>
        <button
          type="button"
          disabled={toggle.isPending}
          onClick={() => toggle.mutate()}
          className="min-h-11 rounded-full border border-line px-3 text-xs text-mute"
        >
          {row.resolved ? "Reopen" : "Mark done"}
        </button>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-paper">{row.message}</p>
      <p className="mt-1 text-mute">
        {row.author_name || "Member"}
        {row.author_email ? ` · ${row.author_email}` : ""}
        {Number.isNaN(when.getTime()) ? "" : ` · ${when.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
      </p>
    </li>
  );
}
