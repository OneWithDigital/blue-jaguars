import { createFileRoute, Link } from "@tanstack/react-router";

const CONTACT_EMAIL = "erikedgington@gmail.com";
const UPDATED = "October 9, 2026";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy | Blue Jaguars" },
      { name: "description", content: "How the Blue Jaguars team room handles family and athlete information." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="min-h-screen bg-ink px-5 py-10 text-paper sm:px-10">
      <article className="mx-auto max-w-2xl space-y-6 leading-relaxed">
        <header>
          <p className="font-display text-sm tracking-[0.35em] text-gold">BLUE JAGUARS</p>
          <h1 className="mt-2 font-display text-4xl tracking-wide">Privacy</h1>
          <p className="mt-2 text-sm text-mute">Last updated {UPDATED}</p>
        </header>

        <section className="space-y-2">
          <h2 className="font-display text-2xl tracking-wide">Who we are</h2>
          <p>
            The Blue Jaguars team room is a private site for the families and instructors of the Blue Jaguars
            sport karate team in Michigan. It is not open to the public. You need an invitation code from the
            team to see anything inside.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl tracking-wide">What we collect</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Your name, email address, and profile picture when you sign in with Google, or the name, email, and
              password you choose when you create an account.
            </li>
            <li>
              Team records that instructors and parents enter: athlete names, ages, belts, competition divisions
              and results, parent names, emails and phone numbers, class check-ins, dues status, cleaning
              rotation, and who holds a dojo key.
            </li>
            <li>Messages you post on the team board, and photos or video links you add to the film page.</li>
          </ul>
          <p>We do not use advertising, tracking pixels, or analytics services.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl tracking-wide">How we use it</h2>
          <p>
            Only to run the team: class schedules, attendance, circuit standings, contact between families and
            instructors, and dues tracking. We never sell or share this information with anyone outside the team.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl tracking-wide">Who can see it</h2>
          <p>
            Signed-in team members see the roster, schedule, results, board, and film. Dues status, key holders,
            and team settings are visible only to instructors and the team owner. Google sign-in is used only to
            confirm who you are; we do not access your Gmail, contacts, or files.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl tracking-wide">Children</h2>
          <p>
            Athlete information is entered by parents and instructors, not collected from children directly. A
            parent or guardian can ask us at any time to see, correct, or remove their child&apos;s information.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl tracking-wide">Cookies and storage</h2>
          <p>
            We use a sign-in cookie to keep you logged in, and your browser remembers whether you have already
            watched the intro. Nothing else is stored in your browser.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl tracking-wide">Where it is kept</h2>
          <p>
            The site and its database run on a private server operated for the team. Data is kept while your
            family is with the team and removed on request when you leave.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-2xl tracking-wide">Contact</h2>
          <p>
            Questions or removal requests:{" "}
            <a className="text-gold underline" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
          </p>
        </section>

        <p>
          <Link to="/" className="text-gold underline">
            Back to the team room
          </Link>
        </p>
      </article>
    </main>
  );
}
