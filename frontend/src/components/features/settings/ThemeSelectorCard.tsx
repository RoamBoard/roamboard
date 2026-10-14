type Props = {
    theme: "light" | "dark";
    onThemeChange: (theme: "light" | "dark") => void;
};

export default function ThemeSelectorCard({
    theme,
    onThemeChange
}: Props) {
    return (
        <div className="border-line bg-background rounded-[2px] border p-6">
            <div className="flex items-center justify-between">
                <h2 className="font-display text-16 text-foreground font-bold uppercase tracking-tight">
                    Appearance / Theme
                </h2>
                <span className="border-line bg-faint text-10 tracking-label text-muted-foreground font-body rounded-[2px] border px-2 py-0.5 font-bold uppercase">
                    {theme === "dark" ? "Dark Mode Active" : "Light Mode Active"}
                </span>
            </div>
            <p className="text-12 text-muted-foreground mt-0.5">
                Choose how Roamboard looks on your device.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-4 max-w-md">
                <button
                    type="button"
                    onClick={() => onThemeChange("light")}
                    className={`border-line cursor-pointer rounded-[2px] border p-4 text-left transition-colors ${
                        theme === "light"
                            ? "border-foreground bg-faint font-bold text-foreground ring-1 ring-foreground/30 shadow-2xs"
                            : "hover:border-foreground text-muted-foreground hover:text-foreground"
                    }`}
                >
                    <div className="text-14 text-foreground font-bold">
                        Light Mode
                    </div>
                    <p className="text-11 text-muted-foreground mt-1">
                        Clean architectural white canvas with
                        graphite typography.
                    </p>
                </button>

                <button
                    type="button"
                    onClick={() => onThemeChange("dark")}
                    className={`border-line cursor-pointer rounded-[2px] border p-4 text-left transition-colors ${
                        theme === "dark"
                            ? "border-foreground bg-faint font-bold text-foreground ring-1 ring-foreground/30 shadow-2xs"
                            : "hover:border-foreground text-muted-foreground hover:text-foreground"
                    }`}
                >
                    <div className="text-14 text-foreground font-bold">
                        Dark Mode
                    </div>
                    <p className="text-11 text-muted-foreground mt-1">
                        Obsidian night palette with high-contrast
                        stone lines.
                    </p>
                </button>
            </div>
        </div>
    );
}

