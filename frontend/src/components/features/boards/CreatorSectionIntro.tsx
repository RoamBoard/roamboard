type Props = {
    title: string;
    description: string;
};

export default function CreatorSectionIntro({ title, description }: Props) {
    return (
        <header className="pb-8">
            <h2 className="text-foreground/80 text-20 sm:text-24 leading-tight font-bold">{title}</h2>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed sm:text-sm">{description}</p>
        </header>
    );
}
