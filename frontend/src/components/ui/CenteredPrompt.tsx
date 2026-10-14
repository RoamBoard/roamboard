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
                className="font-body text-14 text-foreground placeholder:text-muted-foreground focus-visible:outline-foreground max-w-full border-0 bg-transparent text-center font-normal focus-visible:outline-1 focus-visible:outline-offset-4"
            />
        </div>
    );
}
