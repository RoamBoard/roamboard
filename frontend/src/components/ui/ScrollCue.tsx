type Props = {
    targetId: string;
    label?: string;
    className?: string;
};

export default function ScrollCue({ targetId, label = "Scroll down", className = "" }: Props) {
    return (
        <a
            href={`#${targetId}`}
            className={`group text-graphite flex flex-col items-center focus-visible:outline-none ${className}`}
        >
            <span aria-hidden="true" className="bg-line h-16 w-px sm:h-20" />
            <span className="border-line bg-background group-hover:border-foreground group-hover:text-foreground group-focus-visible:outline-foreground grid size-7 place-items-center rounded-full border transition-colors group-focus-visible:outline-2 group-focus-visible:outline-offset-4 motion-reduce:transition-none">
                <svg
                    aria-hidden="true"
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="0.8"
                >
                    <path d="M6 1v9M2.5 6.5 6 10l3.5-3.5" />
                </svg>
            </span>
            <span aria-hidden="true" className="bg-line h-16 w-px sm:h-24" />
            <span className="sr-only">{label}</span>
        </a>
    );
}
