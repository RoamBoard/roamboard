import Link from "next/link";

export default function ViewAllBoards({ href }: { href: string }) {
    return (
        <Link
            href={href}
            className="text-muted-foreground hover:text-foreground inline-flex min-h-11 shrink-0 items-center gap-2 px-2 text-sm whitespace-nowrap underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
        >
            view all <span aria-hidden="true">→</span>
        </Link>
    );
}
