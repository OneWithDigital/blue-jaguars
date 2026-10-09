export function Boot({ label = "The door is opening" }: { label?: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-ink px-6 text-paper">
      <div className="text-center">
        <p className="font-display text-sm tracking-[0.35em] text-gold">MICHIGAN</p>
        <h1 className="font-display text-5xl tracking-wide sm:text-6xl">BLUE JAGUARS</h1>
        <p className="mt-3 text-sm text-mute">{label}</p>
      </div>
    </main>
  );
}

export function errText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}
