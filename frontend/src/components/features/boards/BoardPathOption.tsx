import Link from "next/link";

type Props = {
    title: string;
    description: string;
    href?: string;
};

const optionClasses =
    "group relative grid h-24 w-40 place-items-center rounded-t-full border border-b-0 border-line px-3 text-center transition-colors motion-reduce:transition-none sm:h-28 sm:w-44";

export default function BoardPathOption({ title, description, href }: Props) {
    const content = (
        <span className="relative top-2 block leading-none">
            <strong className="font-body text-14 text-foreground block font-medium">
                {title}
            </strong>
            <span className="text-10 text-graphite mt-1 block">
                {description}
            </span>
        </span>
    );

    if (href) {
        return (
            <Link
                href={href}
                className={`${optionClasses} hover:border-foreground focus-visible:outline-foreground focus-visible:outline-2 focus-visible:outline-offset-4`}
            >
                {content}
            </Link>
        );
    }

    return (
        <div aria-disabled="true" className={`${optionClasses} opacity-55`}>
            {content}
            <span className="sr-only">Coming later.</span>
        </div>
    );
}
