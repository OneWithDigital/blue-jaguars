import { useEffect, useRef, useState } from "react";

export function IntroFilm({ onDone }: { onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(true);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(media.matches);
  }, []);

  useEffect(() => {
    if (!reduce) return;
    const timer = window.setTimeout(onDone, 2800);
    return () => window.clearTimeout(timer);
  }, [reduce, onDone]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-ink text-paper">
      {reduce || failed ? (
        <img
          src="/media/jaguar-still.jpg?v=tornado"
          alt="A fierce blue jaguar fighter in a blue sparring uniform"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          src="/media/jaguar-intro.mp4?v=spin"
          poster="/media/jaguar-still.jpg?v=tornado"
          autoPlay
          muted={muted}
          playsInline
          onTimeUpdate={(event) => {
            const el = event.currentTarget;
            if (el.duration) setProgress(el.currentTime / el.duration);
          }}
          onEnded={onDone}
          onError={() => setFailed(true)}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/25 to-transparent" />
      <div className="bj-rise absolute inset-x-0 bottom-0 z-10 px-5 pb-8 sm:px-10 sm:pb-12">
        <div className="max-w-xl rounded-2xl bg-ink/80 px-4 py-4 backdrop-blur-sm sm:px-5">
          <p className="font-display text-sm tracking-[0.42em] text-gold">MICHIGAN SPORT KARATE</p>
          <h1 className="mt-2 font-display text-6xl leading-none tracking-wide text-paper sm:text-8xl">BLUE JAGUARS</h1>
          <p className="mt-3 max-w-md text-mute">Sports Karate. Members only.</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onDone}
              className="min-h-11 rounded-full bg-blue px-5 py-2 font-display text-lg tracking-wide text-ink"
            >
              Enter
            </button>
            {!reduce && !failed ? (
              <button
                type="button"
                onClick={() => {
                  const next = !muted;
                  setMuted(next);
                  if (videoRef.current) videoRef.current.muted = next;
                }}
                className="min-h-11 rounded-full border border-line bg-ink px-5 py-2 text-sm text-paper"
              >
                {muted ? "Sound on" : "Sound off"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <div className="absolute inset-x-0 top-0 z-10 h-1 bg-line/40">
        <div className="h-full bg-gold" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
    </main>
  );
}
