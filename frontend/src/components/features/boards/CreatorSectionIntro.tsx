type Props = {
    number: string;
    title: string;
    description: string;
};

export default function CreatorSectionIntro({ number, title, description }: Props) {
    return (
        <header className="relative grid grid-cols-[2rem_minmax(0,1fr)] content-start gap-x-3 pb-8 sm:grid-cols-[2.5rem_minmax(0,1fr)] sm:gap-x-4 lg:pb-16">
            <span aria-hidden="true" className="bg-line absolute top-12 bottom-0 left-4 w-px sm:left-5" />
            <span className="text-muted-foreground/55 text-24 sm:text-30 text-center leading-none font-medium">
                {number}
            </span>
            <h2 className="text-foreground/80 text-20 sm:text-24 leading-tight font-bold">{title}</h2>
            <p className="text-muted-foreground col-start-2 mt-2 max-w-56 text-xs leading-relaxed sm:text-sm">
                {description}
            </p>
        </header>
    );
}
