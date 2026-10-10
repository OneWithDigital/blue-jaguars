import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Clapperboard, ExternalLink, Pencil, Play, Plus, Trash2, X } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { errText } from "@/components/boot";
import { formatDay } from "@/lib/dojo";
import {
  addGalleryPhoto,
  addGalleryVideo,
  deleteGalleryAlbum,
  deleteGalleryItem,
  getGallery,
  getGalleryFile,
  syncYouTubeNow,
  updateGalleryItem,
  upsertGalleryAlbum,
  type GalleryAlbum,
  type GalleryItem,
} from "@/lib/gallery-api";

const field =
  "w-full rounded-lg border border-line bg-ink px-3 py-3 text-base text-paper outline-none focus:border-blue";

const DISCIPLINE_OPTIONS = ["", "Forms", "Weapons", "Sparring", "Class"] as const;

function paint(source: CanvasImageSource, width: number, height: number, max: number, quality: number) {
  const scale = Math.min(1, max / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that photo");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

async function compressPhoto(file: File): Promise<{ full: string; thumb: string }> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("Could not read that photo. Use a JPG or PNG.");
  });
  try {
    let max = 1600;
    let quality = 0.74;
    let full = paint(bitmap, bitmap.width, bitmap.height, max, quality);
    while (full.length > 1_100_000 && quality > 0.42) {
      quality -= 0.12;
      max = Math.round(max * 0.85);
      full = paint(bitmap, bitmap.width, bitmap.height, max, quality);
    }
    if (full.length > 1_200_000) throw new Error("That photo is still too big. Try a smaller one.");
    const thumb = paint(bitmap, bitmap.width, bitmap.height, 640, 0.66);
    return { full, thumb };
  } finally {
    bitmap.close();
  }
}

function titleFromName(name: string) {
  const bare = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return bare.slice(0, 80) || "Photo";
}

function youtubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      if (parsed.pathname === "/watch") {
        const id = parsed.searchParams.get("v") ?? "";
        return /^[\w-]{11}$/.test(id) ? id : null;
      }
      const parts = parsed.pathname.split("/").filter(Boolean);
      if ((parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") && parts[1] && /^[\w-]{11}$/.test(parts[1])) {
        return parts[1];
      }
    }
  } catch {
    return null;
  }
  return null;
}

function vimeoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.replace(/^www\./, "").endsWith("vimeo.com")) return null;
    const id = parsed.pathname.split("/").filter(Boolean).pop() ?? "";
    return /^\d+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function isDirectVideo(url: string) {
  return url.startsWith("data:video/") || url.startsWith("/") || /\.(mp4|webm)(\?|#|$)/i.test(url);
}

function hostLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "the link";
  }
}

function useRefreshGallery() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: ["gallery"] });
  };
}

export function LatestFilm() {
  const query = useQuery({ queryKey: ["gallery"], queryFn: () => getGallery() });
  const items = [...(query.data?.items ?? [])].filter((item) => item.poster).sort((a, b) => b.id - a.id).slice(0, 4);
  if (!items.length) return null;
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="font-display text-3xl tracking-wide">Ring film</h2>
        <Link to="/app" search={{ section: "film" }} className="text-sm text-gold">
          Gallery
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item) => (
          <li key={item.id}>
            <Link to="/app" search={{ section: "film" }} className="block overflow-hidden rounded-2xl border border-line bg-panel">
              <span className="relative block aspect-video">
                <img src={item.poster} alt="" className="h-full w-full object-cover" />
                {item.kind === "video" ? (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-ink/80 px-2 py-1 text-xs text-paper">
                    <Play className="size-3" /> Video
                  </span>
                ) : null}
              </span>
              <span className="block truncate px-3 py-2 text-sm">{item.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Gallery({ staff, athletes }: { staff: boolean; athletes: string[] }) {
  const query = useQuery({ queryKey: ["gallery"], queryFn: () => getGallery() });
  const [albumId, setAlbumId] = useState<number | "all">("all");
  const [kind, setKind] = useState<"all" | "photo" | "video">("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [composer, setComposer] = useState<null | { mode: "photo" | "video" | "album"; album?: GalleryAlbum | null }>(null);
  const [editing, setEditing] = useState<GalleryItem | null>(null);

  if (query.isLoading) return <p className="text-mute">Opening the film…</p>;
  if (query.isError || !query.data) {
    return <p className="text-gold">{errText(query.error)}</p>;
  }

  const { albums, items } = query.data;
  const needle = q.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (albumId !== "all" && item.album_id !== albumId) return false;
    if (kind !== "all" && item.kind !== kind) return false;
    if (!needle) return true;
    const hay = `${item.title} ${item.athlete} ${item.discipline} ${item.caption}`.toLowerCase();
    return hay.includes(needle);
  });
  const openItem = items.find((item) => item.id === openId) ?? null;
  const openIndex = openItem ? filtered.findIndex((item) => item.id === openItem.id) : -1;

  function openComposer(mode: "photo" | "video" | "album", album?: GalleryAlbum | null) {
    setEditing(null);
    setOpenId(null);
    setComposer({ mode, album: album ?? null });
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-sm tracking-[0.28em] text-gold">PHOTOS AND FIGHT VIDEO</p>
          <h1 className="font-display text-5xl leading-none tracking-wide">Ring film</h1>
        </div>
        <button
          type="button"
          onClick={() => openComposer("photo")}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-blue px-4 text-sm font-semibold text-ink"
        >
          <Plus className="size-4" /> Add
        </button>
      </div>
      <p className="mb-4 max-w-2xl text-sm text-mute">
        Anyone on the team can file photos. Full-length fights are too big to store here — paste the YouTube, Facebook, or file link. Short clips under 1.5 MB can be uploaded.
        {" "}New public videos on the club YouTube channel are added to the YouTube channel album on their own.
      </p>
      {staff ? <YouTubeCheck /> : null}
      <div className="mb-4 flex flex-wrap gap-2">
        <Chip on={albumId === "all"} onClick={() => setAlbumId("all")}>
          All
        </Chip>
        {albums.map((album) => (
          <Chip key={album.id} on={albumId === album.id} onClick={() => setAlbumId(album.id)}>
            {album.title}
          </Chip>
        ))}
        {staff ? (
          <Chip on={false} onClick={() => openComposer("album")}>
            New album
          </Chip>
        ) : null}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Chip on={kind === "all"} onClick={() => setKind("all")}>
          Photos and video
        </Chip>
        <Chip on={kind === "photo"} onClick={() => setKind("photo")}>
          Photos
        </Chip>
        <Chip on={kind === "video"} onClick={() => setKind("video")}>
          Video
        </Chip>
      </div>
      <label className="mb-6 block">
        <span className="sr-only">Search film</span>
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search an athlete, event, or title"
          className={field}
        />
      </label>
      {albumId === "all" && !needle && kind === "all" ? (
        albums.map((album) => {
          const rows = filtered.filter((item) => item.album_id === album.id);
          return (
            <section key={album.id} className="mb-8">
              <AlbumHeading album={album} count={rows.length} staff={staff} onEdit={() => openComposer("album", album)} />
              {rows.length ? (
                <ItemGrid items={rows} onOpen={setOpenId} />
              ) : (
                <p className="text-sm text-mute">Nothing filed here yet.</p>
              )}
            </section>
          );
        })
      ) : (
        <>
          {albumId !== "all" ? (
            (() => {
              const selected = albums.find((album) => album.id === albumId);
              return selected ? (
                <AlbumHeading
                  album={selected}
                  count={filtered.length}
                  staff={staff}
                  onEdit={() => openComposer("album", selected)}
                />
              ) : null;
            })()
          ) : null}
          {filtered.length ? (
            <ItemGrid items={filtered} onOpen={setOpenId} />
          ) : (
            <p className="text-mute">{items.length ? "Nothing matches that search." : "The gallery is empty."}</p>
          )}
        </>
      )}
      {!albums.length ? <p className="text-mute">No albums yet. An instructor can add one.</p> : null}

      {openItem ? (
        <Viewer
          item={openItem}
          album={albums.find((album) => album.id === openItem.album_id) ?? null}
          hasPrev={openIndex > 0}
          hasNext={openIndex >= 0 && openIndex < filtered.length - 1}
          onPrev={() => {
            const prev = filtered[openIndex - 1];
            if (prev) setOpenId(prev.id);
          }}
          onNext={() => {
            const next = filtered[openIndex + 1];
            if (next) setOpenId(next.id);
          }}
          onClose={() => setOpenId(null)}
          onEdit={() => {
            setEditing(openItem);
            setOpenId(null);
          }}
        />
      ) : null}
      {composer ? (
        <Composer
          key={`${composer.mode}-${composer.album?.id ?? "new"}`}
          mode={composer.mode}
          albums={albums}
          athletes={athletes}
          staff={staff}
          initialAlbumId={composer.album?.id ?? (albumId === "all" ? preferredAlbum(albums) : albumId)}
          existingAlbum={composer.mode === "album" ? composer.album : null}
          onClose={() => setComposer(null)}
          onPickMode={(mode) => setComposer({ mode, album: composer.album })}
        />
      ) : null}
      {editing ? (
        <EditSheet item={editing} albums={albums} athletes={athletes} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}

function preferredAlbum(albums: GalleryAlbum[]) {
  return albums.find((album) => album.title === "Team uploads")?.id ?? albums[0]?.id ?? 0;
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={
        "min-h-11 rounded-full border px-3 text-sm " +
        (on ? "border-blue bg-blue font-semibold text-ink" : "border-line text-paper")
      }
    >
      {children}
    </button>
  );
}

function AlbumHeading({
  album,
  count,
  staff,
  onEdit,
}: {
  album: GalleryAlbum;
  count: number;
  staff: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="font-display text-3xl tracking-wide">{album.title}</h2>
        <p className="text-sm text-mute">
          {album.event_date ? `${formatDay(album.event_date)} · ` : ""}
          {count} {count === 1 ? "item" : "items"}
          {album.notes ? ` · ${album.notes}` : ""}
        </p>
      </div>
      {staff ? (
        <button type="button" onClick={onEdit} className="inline-flex min-h-11 items-center gap-1 text-sm text-gold">
          <Pencil className="size-3.5" /> Album
        </button>
      ) : null}
    </div>
  );
}

function ItemGrid({ items, onOpen }: { items: GalleryItem[]; onOpen: (id: number) => void }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onOpen(item.id)}
            className="block w-full overflow-hidden rounded-2xl border border-line bg-panel text-left"
          >
            <span className="relative block aspect-video bg-panel-2">
              {item.poster ? (
                <img src={item.poster} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full place-items-center text-mute">
                  <Clapperboard className="size-6" />
                </span>
              )}
              {item.kind === "video" ? (
                <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-ink/80 px-2 py-1 text-xs text-paper">
                  <Play className="size-3" /> Video
                </span>
              ) : null}
            </span>
            <span className="block px-3 py-3">
              <span className="block truncate">{item.title}</span>
              <span className="block truncate text-sm text-mute">
                {[item.athlete, item.discipline].filter(Boolean).join(" · ") || "Team"}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Viewer({
  item,
  album,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onClose,
  onEdit,
}: {
  item: GalleryItem;
  album: GalleryAlbum | null;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onEdit: () => void;
}) {
  const file = useQuery({
    queryKey: ["gallery-file", item.id],
    queryFn: () => getGalleryFile({ data: { id: item.id } }),
    enabled: item.has_file,
  });
  const media = item.has_file ? (file.data?.data ?? "") : item.kind === "video" ? item.video_url : item.poster;
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/80" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-2xl border border-line bg-panel p-4 text-paper sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-3xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-4xl leading-none tracking-wide">{item.title}</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-mute">
                {[item.athlete, item.discipline, album?.title].filter(Boolean).join(" · ") || "Team film"}
              </Dialog.Description>
            </div>
            <Dialog.Close className="grid size-11 shrink-0 place-items-center rounded-lg border border-line" aria-label="Close">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          {item.has_file && file.isLoading ? <p className="mb-3 text-sm text-mute">Opening the file…</p> : null}
          {item.has_file && file.isError ? <p className="mb-3 text-sm text-gold">{errText(file.error)}</p> : null}
          {item.kind === "photo" ? (
            media ? <img src={media} alt={item.title} className="max-h-[60vh] w-full rounded-xl object-contain bg-ink" /> : null
          ) : (
            <VideoPlayer url={media} title={item.title} poster={item.poster} />
          )}
          {item.caption ? <p className="mt-3 text-sm text-mute">{item.caption}</p> : null}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" disabled={!hasPrev} onClick={onPrev} className="min-h-11 rounded-full border border-line px-4 text-sm disabled:opacity-40">
              Previous
            </button>
            <button type="button" disabled={!hasNext} onClick={onNext} className="min-h-11 rounded-full border border-line px-4 text-sm disabled:opacity-40">
              Next
            </button>
            {item.can_edit ? (
              <>
                <button type="button" onClick={onEdit} className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line px-4 text-sm">
                  <Pencil className="size-3.5" /> Edit
                </button>
                <RemoveItem id={item.id} onDone={onClose} />
              </>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function VideoPlayer({ url, title, poster }: { url: string; title: string; poster: string }) {
  const youtube = url ? youtubeId(url) : null;
  const vimeo = url && !youtube ? vimeoId(url) : null;
  if (!url) {
    return poster ? <img src={poster} alt="" className="max-h-[60vh] w-full rounded-xl object-contain bg-ink" /> : <p className="text-sm text-mute">No video file on this one yet.</p>;
  }
  if (youtube) {
    return (
      <iframe
        className="aspect-video w-full rounded-xl bg-ink"
        src={`https://www.youtube.com/embed/${youtube}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    );
  }
  if (vimeo) {
    return (
      <iframe
        className="aspect-video w-full rounded-xl bg-ink"
        src={`https://player.vimeo.com/video/${vimeo}`}
        title={title}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    );
  }
  if (isDirectVideo(url)) {
    return <video controls playsInline poster={poster || undefined} className="max-h-[60vh] w-full rounded-xl bg-ink" src={url} />;
  }
  return (
    <div className="rounded-xl border border-line bg-ink p-4">
      {poster ? <img src={poster} alt="" className="mb-4 max-h-64 w-full rounded-lg object-cover" /> : null}
      <p className="text-sm text-mute">This one plays on {hostLabel(url)}.</p>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-blue px-4 font-semibold text-ink"
      >
        Open video <ExternalLink className="size-4" />
      </a>
    </div>
  );
}

function RemoveItem({ id, onDone }: { id: number; onDone: () => void }) {
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useRefreshGallery();
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center gap-1 text-sm text-mute"
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setBusy(true);
        setError("");
        void deleteGalleryItem({ data: { id } })
          .then(async () => {
            await refresh();
            onDone();
          })
          .catch((cause) => {
            setError(errText(cause));
            setBusy(false);
          });
      }}
    >
      <Trash2 className="size-3.5" /> {busy ? "Removing…" : armed ? "Confirm remove" : "Remove"}
      {error ? <span className="text-gold">{error}</span> : null}
    </button>
  );
}

function SheetFrame({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/80" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-2xl border border-line bg-panel p-5 text-paper sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-4xl leading-none tracking-wide">{title}</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-mute">{description}</Dialog.Description>
            </div>
            <Dialog.Close className="grid size-11 shrink-0 place-items-center rounded-lg border border-line" aria-label="Close">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Composer({
  mode,
  albums,
  athletes,
  staff,
  initialAlbumId,
  existingAlbum,
  onClose,
  onPickMode,
}: {
  mode: "photo" | "video" | "album";
  albums: GalleryAlbum[];
  athletes: string[];
  staff: boolean;
  initialAlbumId: number;
  existingAlbum: GalleryAlbum | null | undefined;
  onClose: () => void;
  onPickMode: (mode: "photo" | "video" | "album") => void;
}) {
  return (
    <SheetFrame
      title={mode === "album" ? (existingAlbum ? "Album" : "New album") : mode === "video" ? "Add video" : "Add photos"}
      description={
        mode === "album"
          ? "Group a tournament weekend or a stretch of class photos."
          : "File it under an album so the team can find it later."
      }
      onClose={onClose}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Chip on={mode === "photo"} onClick={() => onPickMode("photo")}>
          Photos
        </Chip>
        <Chip on={mode === "video"} onClick={() => onPickMode("video")}>
          Video
        </Chip>
        {staff ? (
          <Chip on={mode === "album"} onClick={() => onPickMode("album")}>
            Album
          </Chip>
        ) : null}
      </div>
      {mode === "photo" ? (
        <PhotoForm albums={albums} athletes={athletes} initialAlbumId={initialAlbumId} onClose={onClose} />
      ) : null}
      {mode === "video" ? (
        <VideoForm albums={albums} athletes={athletes} initialAlbumId={initialAlbumId} onClose={onClose} />
      ) : null}
      {mode === "album" && staff ? <AlbumForm existing={existingAlbum ?? null} onClose={onClose} /> : null}
    </SheetFrame>
  );
}

function AlbumFields({
  albums,
  athletes,
  albumId,
  athlete,
  discipline,
  onAlbum,
  onAthlete,
  onDiscipline,
}: {
  albums: GalleryAlbum[];
  athletes: string[];
  albumId: string;
  athlete: string;
  discipline: string;
  onAlbum: (value: string) => void;
  onAthlete: (value: string) => void;
  onDiscipline: (value: string) => void;
}) {
  return (
    <>
      <label className="block">
        <span className="mb-1 block text-xs tracking-[0.14em] text-mute uppercase">Album</span>
        <select value={albumId} onChange={(event) => onAlbum(event.target.value)} className={field}>
          {albums.map((album) => (
            <option key={album.id} value={album.id}>
              {album.title}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs tracking-[0.14em] text-mute uppercase">Athlete</span>
        <input value={athlete} list="film-athletes" onChange={(event) => onAthlete(event.target.value)} className={field} placeholder="Optional" />
        <datalist id="film-athletes">
          {athletes.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs tracking-[0.14em] text-mute uppercase">Discipline</span>
        <select value={discipline} onChange={(event) => onDiscipline(event.target.value)} className={field}>
          {DISCIPLINE_OPTIONS.map((option) => (
            <option key={option || "none"} value={option}>
              {option || "Not set"}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

type PendingPhoto = {
  key: string;
  name: string;
  title: string;
  full: string;
  thumb: string;
  status: "ready" | "uploading" | "done" | "error";
  error?: string;
};

function PhotoForm({
  albums,
  athletes,
  initialAlbumId,
  onClose,
}: {
  albums: GalleryAlbum[];
  athletes: string[];
  initialAlbumId: number;
  onClose: () => void;
}) {
  const refresh = useRefreshGallery();
  const [albumId, setAlbumId] = useState(String(initialAlbumId || albums[0]?.id || ""));
  const [athlete, setAthlete] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [caption, setCaption] = useState("");
  const [files, setFiles] = useState<PendingPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onPick(list: FileList | null) {
    if (!list?.length) return;
    setError("");
    const next: PendingPhoto[] = [];
    for (const file of Array.from(list)) {
      try {
        const packed = await compressPhoto(file);
        next.push({
          key: `${file.name}-${file.size}-${next.length}-${Math.random()}`,
          name: file.name,
          title: titleFromName(file.name),
          full: packed.full,
          thumb: packed.thumb,
          status: "ready",
        });
      } catch (cause) {
        next.push({
          key: `${file.name}-bad-${next.length}`,
          name: file.name,
          title: titleFromName(file.name),
          full: "",
          thumb: "",
          status: "error",
          error: errText(cause),
        });
      }
    }
    setFiles((current) => [...current, ...next]);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const ready = files.filter((file) => file.status === "ready" || file.status === "error");
    if (!ready.some((file) => file.full)) {
      setError("Choose at least one photo");
      return;
    }
    setBusy(true);
    setError("");
    let failed = 0;
    for (const file of files) {
      if (!file.full || file.status === "done") continue;
      setFiles((current) => current.map((row) => (row.key === file.key ? { ...row, status: "uploading", error: "" } : row)));
      try {
        await addGalleryPhoto({
          data: {
            album_id: Number(albumId),
            title: file.title,
            athlete,
            discipline,
            caption,
            poster: file.thumb,
            file: file.full,
          },
        });
        setFiles((current) => current.map((row) => (row.key === file.key ? { ...row, status: "done" } : row)));
      } catch (cause) {
        failed += 1;
        const message = errText(cause);
        setFiles((current) => current.map((row) => (row.key === file.key ? { ...row, status: "error", error: message } : row)));
      }
    }
    await refresh();
    setBusy(false);
    if (!failed) onClose();
  }

  if (!albums.length) return <p className="text-sm text-mute">An instructor needs to make an album first.</p>;

  return (
    <form className="space-y-3" onSubmit={(event) => void onSubmit(event)}>
      <AlbumFields
        albums={albums}
        athletes={athletes}
        albumId={albumId}
        athlete={athlete}
        discipline={discipline}
        onAlbum={setAlbumId}
        onAthlete={setAthlete}
        onDiscipline={setDiscipline}
      />
      <label className="block">
        <span className="mb-1 block text-xs tracking-[0.14em] text-mute uppercase">Note for this batch</span>
        <input value={caption} onChange={(event) => setCaption(event.target.value)} className={field} placeholder="Optional" />
      </label>
      <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line px-4 text-sm">
        Choose photos
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={(event) => {
            void onPick(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      {files.length ? (
        <ul className="space-y-2 text-sm">
          {files.map((file) => (
            <li key={file.key} className="rounded-lg border border-line px-3 py-2">
              <span className="block truncate">{file.title}</span>
              <span className="text-mute">
                {file.status === "uploading" ? "Uploading…" : file.status === "done" ? "Saved" : file.error || "Ready"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="text-sm text-gold">{error}</p> : null}
      <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-blue px-4 font-semibold text-ink disabled:opacity-60">
        {busy ? "Uploading…" : "Save photos"}
      </button>
    </form>
  );
}

function VideoForm({
  albums,
  athletes,
  initialAlbumId,
  onClose,
}: {
  albums: GalleryAlbum[];
  athletes: string[];
  initialAlbumId: number;
  onClose: () => void;
}) {
  const refresh = useRefreshGallery();
  const [albumId, setAlbumId] = useState(String(initialAlbumId || albums[0]?.id || ""));
  const [title, setTitle] = useState("");
  const [athlete, setAthlete] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [caption, setCaption] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [file, setFile] = useState("");
  const [fileName, setFileName] = useState("");
  const [poster, setPoster] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!albums.length) return <p className="text-sm text-mute">An instructor needs to make an album first.</p>;

  async function onClip(list: FileList | null) {
    const picked = list?.[0];
    if (!picked) return;
    if (picked.size > 1_500_000) {
      setFile("");
      setFileName("");
      setError("That clip is over 1.5 MB. Post it on YouTube or Facebook and paste the link.");
      return;
    }
    setError("");
    const data = await readFile(picked);
    if (!/^data:video\/(?:mp4|webm|quicktime);/i.test(data)) {
      setError("Use an MP4 or WebM clip.");
      return;
    }
    setFile(data);
    setFileName(picked.name);
    setVideoUrl("");
  }

  async function onCover(list: FileList | null) {
    const picked = list?.[0];
    if (!picked) return;
    const packed = await compressPhoto(picked);
    setPoster(packed.thumb);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await addGalleryVideo({
        data: {
          album_id: Number(albumId),
          title,
          athlete,
          discipline,
          caption,
          poster,
          video_url: file ? "" : videoUrl,
          file,
        },
      });
      await refresh();
      onClose();
    } catch (cause) {
      setError(errText(cause));
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={(event) => void onSubmit(event)}>
      <label className="block">
        <span className="mb-1 block text-xs tracking-[0.14em] text-mute uppercase">Title</span>
        <input required value={title} onChange={(event) => setTitle(event.target.value)} className={field} />
      </label>
      <AlbumFields
        albums={albums}
        athletes={athletes}
        albumId={albumId}
        athlete={athlete}
        discipline={discipline}
        onAlbum={setAlbumId}
        onAthlete={setAthlete}
        onDiscipline={setDiscipline}
      />
      <label className="block">
        <span className="mb-1 block text-xs tracking-[0.14em] text-mute uppercase">Link</span>
        <input
          value={videoUrl}
          onChange={(event) => {
            setVideoUrl(event.target.value);
            if (event.target.value.trim()) {
              setFile("");
              setFileName("");
            }
          }}
          placeholder="https://"
          className={field}
          inputMode="url"
        />
      </label>
      <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line px-4 text-sm">
        {fileName ? fileName : "Or choose a short clip"}
        <input
          type="file"
          accept="video/mp4,video/webm"
          className="sr-only"
          onChange={(event) => {
            void onClip(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line px-4 text-sm">
        {poster ? "Cover added" : "Optional cover photo"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            void onCover(event.target.files).catch((cause) => setError(errText(cause)));
            event.target.value = "";
          }}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs tracking-[0.14em] text-mute uppercase">Note</span>
        <input value={caption} onChange={(event) => setCaption(event.target.value)} className={field} />
      </label>
      {error ? <p className="text-sm text-gold">{error}</p> : null}
      <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-blue px-4 font-semibold text-ink disabled:opacity-60">
        {busy ? "Saving…" : "Save video"}
      </button>
    </form>
  );
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });
}

function AlbumForm({ existing, onClose }: { existing: GalleryAlbum | null; onClose: () => void }) {
  const refresh = useRefreshGallery();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [eventDate, setEventDate] = useState(existing?.event_date ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [armed, setArmed] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await upsertGalleryAlbum({
        data: { id: existing?.id ?? null, title, event_date: eventDate, notes },
      });
      await refresh();
      onClose();
    } catch (cause) {
      setError(errText(cause));
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={(event) => void onSubmit(event)}>
      <label className="block">
        <span className="mb-1 block text-xs tracking-[0.14em] text-mute uppercase">Name</span>
        <input required value={title} onChange={(event) => setTitle(event.target.value)} className={field} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs tracking-[0.14em] text-mute uppercase">Date</span>
        <input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} className={field} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs tracking-[0.14em] text-mute uppercase">Note</span>
        <input value={notes} onChange={(event) => setNotes(event.target.value)} className={field} />
      </label>
      {error ? <p className="text-sm text-gold">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-blue px-4 font-semibold text-ink disabled:opacity-60">
          {busy ? "Saving…" : "Save album"}
        </button>
        {existing ? (
          <button
            type="button"
            className="min-h-11 text-sm text-mute"
            onClick={() => {
              if (!armed) {
                setArmed(true);
                return;
              }
              setBusy(true);
              void deleteGalleryAlbum({ data: { id: existing.id } })
                .then(async () => {
                  await refresh();
                  onClose();
                })
                .catch((cause) => {
                  setError(errText(cause));
                  setBusy(false);
                });
            }}
          >
            {armed ? "Confirm delete album" : "Delete album"}
          </button>
        ) : null}
      </div>
      {armed ? <p className="text-sm text-mute">Deleting the album removes every photo and video inside it.</p> : null}
    </form>
  );
}

function EditSheet({
  item,
  albums,
  athletes,
  onClose,
}: {
  item: GalleryItem;
  albums: GalleryAlbum[];
  athletes: string[];
  onClose: () => void;
}) {
  const refresh = useRefreshGallery();
  const [albumId, setAlbumId] = useState(String(item.album_id));
  const [title, setTitle] = useState(item.title);
  const [athlete, setAthlete] = useState(item.athlete);
  const [discipline, setDiscipline] = useState(item.discipline);
  const [caption, setCaption] = useState(item.caption);
  const [videoUrl, setVideoUrl] = useState(item.video_url.startsWith("http") ? item.video_url : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await updateGalleryItem({
        data: {
          id: item.id,
          album_id: Number(albumId),
          title,
          athlete,
          discipline,
          caption,
          video_url: item.kind === "video" && !item.has_file && !item.video_url.startsWith("/") ? videoUrl : null,
        },
      });
      await refresh();
      onClose();
    } catch (cause) {
      setError(errText(cause));
      setBusy(false);
    }
  }

  return (
    <SheetFrame title="Edit" description="Titles, athlete, and album. The file itself stays put." onClose={onClose}>
      <form className="space-y-3" onSubmit={(event) => void onSubmit(event)}>
        <label className="block">
          <span className="mb-1 block text-xs tracking-[0.14em] text-mute uppercase">Title</span>
          <input required value={title} onChange={(event) => setTitle(event.target.value)} className={field} />
        </label>
        <AlbumFields
          albums={albums}
          athletes={athletes}
          albumId={albumId}
          athlete={athlete}
          discipline={discipline}
          onAlbum={setAlbumId}
          onAthlete={setAthlete}
          onDiscipline={setDiscipline}
        />
        {item.kind === "video" && !item.has_file && !item.video_url.startsWith("/") ? (
          <label className="block">
            <span className="mb-1 block text-xs tracking-[0.14em] text-mute uppercase">Link</span>
            <input required value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} className={field} />
          </label>
        ) : null}
        <label className="block">
          <span className="mb-1 block text-xs tracking-[0.14em] text-mute uppercase">Note</span>
          <input value={caption} onChange={(event) => setCaption(event.target.value)} className={field} />
        </label>
        {error ? <p className="text-sm text-gold">{error}</p> : null}
        <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-blue px-4 font-semibold text-ink disabled:opacity-60">
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
    </SheetFrame>
  );
}

function YouTubeCheck() {
  const queryClient = useQueryClient();
  const check = useMutation({
    mutationFn: () => syncYouTubeNow(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["gallery"] });
    },
  });
  const result = check.data;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={check.isPending}
        onClick={() => check.mutate()}
        className="min-h-11 rounded-full border border-line px-4 text-sm text-mute disabled:opacity-60"
      >
        {check.isPending ? "Checking YouTube…" : "Check YouTube now"}
      </button>
      {check.isError ? <span className="text-sm text-gold">{errText(check.error)}</span> : null}
      {result ? (
        <span className="text-sm text-mute">
          {result.status === "none"
            ? "The channel has no public videos yet. Unlisted and private videos are not picked up."
            : result.added
              ? `Added ${result.added} new ${result.added === 1 ? "video" : "videos"}.`
              : "Up to date. No new videos."}
        </span>
      ) : null}
    </div>
  );
}
