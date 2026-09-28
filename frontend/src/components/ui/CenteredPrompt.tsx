type Props = {
  placeholder: string;
  label: string;
  name?: string;
};

export default function CenteredPrompt({ placeholder, label, name = "destination" }: Props) {
  return (
    <div className="grid place-items-center text-center">
      <input
        type="text"
        name={name}
        aria-label={label}
        placeholder={placeholder}
        size={placeholder.length}
        className="max-w-full border-0 bg-transparent text-center font-body text-14 font-normal text-obsidian placeholder:text-graphite focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-graphite"
      />
    </div>
  );
}
