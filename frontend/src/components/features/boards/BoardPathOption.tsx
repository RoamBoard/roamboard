import Link from "next/link";

type Props = {
    title: string;
    description: string;
    href?: string;
    compact?: boolean;
};

export default function BoardPathOption({ title, description, href, compact = false }: Props) {
    const content = (
        <span className="relative z-10 px-4">
            <strong
                className={`block leading-tight font-bold ${compact ? "text-sm" : "text-[clamp(1.125rem,1.5vw,1.5rem)]"}`}
            >
                {title}
            </strong>
            <span
                className={`text-muted-foreground mx-auto mt-2 block max-w-48 leading-relaxed ${compact ? "text-[10px]" : "text-xs"}`}
            >
                {description}
            </span>
            {!href ? (
                <span className="text-muted-foreground mt-3 block text-[9px] tracking-[0.12em] uppercase">
                    Coming later
                </span>
            ) : null}
        </span>
    );
    const classes = `group relative grid aspect-square place-items-center rounded-full text-center before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:border before:border-line before:[mask-image:linear-gradient(to_bottom,black_25%,transparent_95%)] ${compact ? "w-40" : "w-[clamp(12rem,16vw,16.25rem)]"}`;

    if (href) {
        return (
            <Link
                href={href}
                className={`${classes} hover:before:border-foreground/50 focus-visible:outline-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-8 motion-reduce:transition-none`}
            >
                {content}
            </Link>
        );
    }

    return (
        <div aria-disabled="true" className={classes}>
            {content}
        </div>
    );
}
