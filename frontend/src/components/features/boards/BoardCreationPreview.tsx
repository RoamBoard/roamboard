/* eslint-disable @next/next/no-img-element */

import { dayColors, type BoardCreatorPayload } from "@/types/board-creator";

type Props = {
  board: BoardCreatorPayload;
};

export default function BoardCreationPreview({ board }: Props) {
  const pins = board.days.flatMap((day) => day.pins);
  return (
    <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        <p className="text-10 font-bold uppercase tracking-label text-graphite">Cover images</p>
        <div className="mt-4 grid max-w-sm grid-cols-3 gap-1">
          {board.images.slice(0, 6).map((image) => <img key={image.id} src={image.thumbnailUrl} alt="" className="aspect-[3/4] w-full object-cover" />)}
          {board.images.length === 0 ? <div className="col-span-3 grid aspect-video place-items-center bg-faint text-12 text-graphite">No images yet</div> : null}
        </div>
      </div>

      <article className="border-l border-line pl-8" aria-label="Board preview">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-10 uppercase tracking-label text-stone">Board preview</p>
            <h3 className="mt-3 max-w-md font-display text-48 font-bold leading-[0.9]">{board.title || "Untitled Board"}</h3>
          </div>
          <span className="border border-line px-3 py-2 text-10 uppercase tracking-label">{board.visibility}</span>
        </div>
        <p className="mt-6 max-w-xl text-14 leading-6 text-graphite">{board.description || "Your Board description will appear here."}</p>
        <div className="mt-7 flex flex-wrap gap-5 text-12 text-graphite">
          <span>{board.days.length} day{board.days.length === 1 ? "" : "s"}</span>
          <span>{pins.length} pin{pins.length === 1 ? "" : "s"}</span>
          <span>{board.images.length} image{board.images.length === 1 ? "" : "s"}</span>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {board.days.map((day, index) => (
            <section key={day.id} className="border-t pt-4" style={{ borderColor: dayColors[index % dayColors.length] }}>
              <h4 className="font-display text-20 font-bold">Day {day.dayNumber}</h4>
              <ol className="mt-3 grid gap-2 text-12 text-graphite">
                {day.pins.slice(0, 5).map((pin) => <li key={pin.id}><time>{pin.time}</time> · <span className="text-foreground">{pin.title}</span></li>)}
                {day.pins.length === 0 ? <li>No pins yet</li> : null}
              </ol>
            </section>
          ))}
        </div>
        <dl className="mt-9 grid gap-6 border-t border-line pt-6 sm:grid-cols-3">
          <div><dt className="text-10 uppercase tracking-label text-stone">Tags</dt><dd className="mt-2 text-12 text-graphite">{board.tags.join(" · ") || "None"}</dd></div>
          <div><dt className="text-10 uppercase tracking-label text-stone">Vibes</dt><dd className="mt-2 text-12 text-graphite">{board.vibes.join(" · ") || "None"}</dd></div>
          <div><dt className="text-10 uppercase tracking-label text-stone">Highlights</dt><dd className="mt-2 text-12 text-graphite">{board.highlights.join(" · ") || "None"}</dd></div>
        </dl>
      </article>
    </div>
  );
}
