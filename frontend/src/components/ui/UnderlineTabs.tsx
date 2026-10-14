"use client";

type Props<T extends string> = {
    tabs: readonly T[] | T[];
    activeTab: T;
    onChange: (tab: T) => void;
    ariaLabel?: string;
    className?: string;
};

export default function UnderlineTabs<T extends string>({
    tabs,
    activeTab,
    onChange,
    ariaLabel = "Navigation tabs",
    className = ""
}: Props<T>) {
    return (
        <nav
            aria-label={ariaLabel}
            className={`border-line mt-4 flex items-center gap-6 border-b pb-3 ${className}`}
        >
            {tabs.map((tab) => {
                const isActive = activeTab === tab;
                return (
                    <button
                        key={tab}
                        type="button"
                        onClick={() => onChange(tab)}
                        aria-current={isActive ? "true" : undefined}
                        className={`text-12 cursor-pointer font-bold tracking-wider uppercase transition-colors focus-visible:outline-1 focus-visible:outline-offset-4 ${
                            isActive
                                ? "text-foreground underline decoration-2 underline-offset-8"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {tab}
                    </button>
                );
            })}
        </nav>
    );
}

