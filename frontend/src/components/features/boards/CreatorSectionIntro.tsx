type Props = {
    number: string;
    title: string;
    description: string;
};

export default function CreatorSectionIntro({
    number,
    title,
    description
}: Props) {
    return (
        <header className="border-line relative border-l pl-10 sm:pl-12">
            <span className="font-display text-24 text-line absolute top-0 -left-1 -translate-x-full">
                {number}
            </span>
            <h2 className="font-display text-20 text-foreground sm:text-24 leading-none font-bold">
                {title}
            </h2>
            <p className="text-12 text-stone mt-2 max-w-52 leading-4">
                {description}
            </p>
        </header>
    );
}
