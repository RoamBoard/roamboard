import BoardPathOption from "@/components/features/boards/BoardPathOption";
import ScrollCue from "@/components/ui/ScrollCue";

export default function BoardsLanding() {
  return (
    <article className="relative min-h-[100rem] w-full min-w-0 overflow-hidden bg-background text-foreground sm:min-h-[112rem]">
      <section
        className="flex flex-col items-center px-5 text-center sm:px-10"
        aria-labelledby="boards-heading"
      >
        <div
          role="img"
          aria-label="Stylized rock formations at sunset"
          className="h-[clamp(11rem,31vw,23rem)] w-full max-w-5xl shrink-0 rounded-b-[50%] bg-[url('/boards-create-cover.svg')] bg-cover bg-center"
        />

        <h1
          id="boards-heading"
          className="mt-10 max-w-full font-display text-48 font-bold leading-none tracking-tight sm:mt-12 sm:text-72 lg:text-96"
        >
          CREATE
        </h1>

        <ScrollCue
          targetId="board-paths"
          label="Scroll to Board creation options"
          className="mt-7"
        />

        <div className="pointer-events-none absolute left-4 right-4 top-[27%] hidden items-center justify-between text-10 text-stone lg:flex">
          <span>the world is your canvas</span>
          <span>paint it with memories</span>
        </div>
      </section>

      <section
        id="board-paths"
        aria-labelledby="board-paths-heading"
        className="scroll-mt-8 px-5 text-center"
      >
        <h2 id="board-paths-heading" className="sr-only">
          Choose how to create a Board
        </h2>

        <ol className="flex flex-col items-center">
          <li>
            <BoardPathOption
              href="/boards/new"
              title="new board"
              description="build your journey"
            />
          </li>
          <li aria-label="Remix saved Board, coming later" className="flex flex-col items-center">
            <span aria-hidden="true" className="h-16 w-px bg-line sm:h-20" />
            <BoardPathOption
              title="remix saved board"
              description="inspired by others, made your own"
            />
          </li>
          <li aria-label="Edit draft, coming later" className="flex flex-col items-center">
            <span aria-hidden="true" className="h-16 w-px bg-line sm:h-20" />
            <BoardPathOption
              title="edit draft"
              description="continue where you left off"
            />
          </li>
        </ol>

        <div aria-hidden="true" className="mx-auto h-44 w-px bg-line sm:h-52" />

        <p className="font-body text-16 font-bold text-line sm:text-20">
          need more inspiration?
        </p>
        <p className="mt-6 max-w-full font-display text-48 font-bold leading-none tracking-tight sm:text-72 lg:text-96">
          DISCOVER
        </p>
      </section>
    </article>
  );
}
