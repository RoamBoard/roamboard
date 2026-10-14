import Link from "next/link";
import ThemeSelect from "@/components/ui/ThemeSelect";

type Props = {
    activeHref: string;
    discover?: { collapsed: boolean };
};

const navigation = [
    { href: "/home", label: "roam" },
    { href: "/discover", label: "discover" },
    { href: "/boards", label: "boards" },
    { href: "/social", label: "social" }
];

export default function Sidebar({ activeHref, discover }: Props) {
    const linkClasses =
        "inline-flex min-h-6 items-center text-muted-foreground underline-offset-2 hover:underline aria-[current=true]:text-foreground aria-[current=true]:underline focus-visible:outline-foreground focus-visible:outline-1 focus-visible:outline-offset-4";
    const themeControl = (
        <div className="absolute inset-x-0 bottom-3 flex justify-center">
            <ThemeSelect side="top" />
        </div>
    );

    if (discover) {
        return (
            <aside
                className={`bg-background border-line fixed inset-y-0 left-0 z-30 border-r transition-[width] duration-300 motion-reduce:transition-none ${discover.collapsed ? "w-16 md:w-20" : "w-20 md:w-32"}`}
            >
                <header className="absolute top-7 left-1/2 -translate-x-1/2">
                    <Link
                        href="/home"
                        aria-label="Roamboard home"
                        className={`font-display block leading-none font-bold tracking-tight transition-[font-size] duration-300 [writing-mode:vertical-rl] focus-visible:outline-2 focus-visible:outline-offset-4 motion-reduce:transition-none ${discover.collapsed ? "text-24 md:text-30" : "text-30 md:text-48"}`}
                    >
                        ROAMBOARD
                    </Link>
                </header>
                <nav
                    aria-label="Main navigation"
                    className={`absolute left-0 flex w-full flex-col items-center ${discover.collapsed ? "top-64 gap-2" : "top-[54%] bottom-28 justify-between"}`}
                >
                    {navigation.map(({ href, label }) => (
                        <Link
                            key={href}
                            href={href}
                            aria-label={label}
                            aria-current={activeHref === href ? "page" : undefined}
                            className="group text-12 relative flex min-h-10 min-w-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                            {discover.collapsed ? (
                                <>
                                    <span
                                        aria-hidden="true"
                                        className={`size-2 rounded-full border border-current ${activeHref === href ? "bg-foreground" : "text-muted-foreground"}`}
                                    />
                                    <span className="bg-background border-line absolute left-full ml-2 hidden rounded border px-3 py-2 group-hover:block group-focus-visible:block">
                                        {label}
                                    </span>
                                </>
                            ) : (
                                <span
                                    className={
                                        activeHref === href ? "underline underline-offset-4" : "text-muted-foreground"
                                    }
                                >
                                    {label}
                                </span>
                            )}
                        </Link>
                    ))}
                </nav>
                {themeControl}
            </aside>
        );
    }

    return (
        <aside className="bg-background relative z-10 min-h-dvh">
            <header className="absolute top-[3%] left-1/2 -translate-x-1/2">
                <Link
                    href="/home"
                    aria-label="Roamboard home"
                    className="font-display text-48 block leading-none font-bold tracking-tight [writing-mode:vertical-rl] focus-visible:outline-1 focus-visible:outline-offset-4"
                >
                    ROAMBOARD
                </Link>
            </header>
            <nav
                aria-label="Main navigation"
                className="text-12 absolute top-[59%] bottom-20 left-1/2 flex -translate-x-1/2 flex-col items-start justify-between"
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
            {themeControl}
        </aside>
    );
}
