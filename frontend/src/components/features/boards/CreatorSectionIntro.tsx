type Props = {
  number: string;
  title: string;
  description: string;
};

export default function CreatorSectionIntro({ number, title, description }: Props) {
  return (
    <header className="relative border-l border-line pl-10 sm:pl-12">
      <span className="absolute -left-1 top-0 -translate-x-full font-display text-24 text-line">
        {number}
      </span>
      <h2 className="font-display text-20 font-bold leading-none text-foreground sm:text-24">
        {title}
      </h2>
      <p className="mt-2 max-w-52 text-12 leading-4 text-stone">{description}</p>
    </header>
  );
}
