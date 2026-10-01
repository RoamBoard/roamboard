import Link from "next/link";

type Props = {
  activeHref: string;
};

export default function Sidebar({ activeHref }: Props) {
  const linkClasses = "inline-flex min-h-6 items-center text-graphite underline-offset-2 hover:underline aria-[current=true]:text-obsidian aria-[current=true]:underline focus-visible:outline-1 focus-visible:outline-offset-4";

  return (
    <aside className="relative z-10 min-h-dvh">
      <header className="absolute left-1/2 top-[3%] -translate-x-1/2">
        <Link
          href="/home"
          aria-label="Roamboard home"
          className="block font-display text-48 font-bold leading-none tracking-tight [writing-mode:vertical-rl] focus-visible:outline-1 focus-visible:outline-offset-4"
        >
          ROAMBOARD
        </Link>
      </header>
      <nav
        aria-label="Main navigation"
        className="absolute bottom-[5%] left-1/2 top-[59%] flex -translate-x-1/2 flex-col items-start justify-between text-12"
      >
        <Link href="/home" aria-current={activeHref === "/home"} className={linkClasses}>
          roam
        </Link>
        <Link href="/discover" aria-current={activeHref === "/discover"} className={linkClasses}>
          discover
        </Link>
        <Link href="/boards" aria-current={activeHref === "/boards"} className={linkClasses}>
          boards
        </Link>
        <Link href="/social" aria-current={activeHref === "/social"} className={linkClasses}>
          social
        </Link>
        <Link href="/dev/providers" aria-current={activeHref === "/dev/providers"} className={linkClasses}>
          labs
        </Link>
      </nav>
    </aside>
  );
}
