"use client";

import { useState } from "react";

type Props = {
    languages: string[];
    onChangeLanguages: (languages: string[]) => void;
    choices: string[];
    maxLanguages?: number;
};

export default function LanguageEditor({ languages, onChangeLanguages, choices, maxLanguages = 10 }: Props) {
    const [newLanguage, setNewLanguage] = useState("");

    function handleAddLanguage() {
        if (languages.length >= maxLanguages) return;
        if (choices.includes(newLanguage) && !languages.includes(newLanguage)) {
            onChangeLanguages([...languages, newLanguage]);
            setNewLanguage("");
        }
    }

    function handleRemoveLanguage(item: string) {
        onChangeLanguages(languages.filter((l) => l !== item));
    }

    return (
        <div className="border-line bg-background rounded-[2px] border p-6">
            <div className="flex items-center justify-between">
                <h2 className="font-display text-16 text-foreground font-bold tracking-tight uppercase">
                    Languages Spoken
                </h2>
                <span className="text-11 text-muted-foreground font-medium">
                    ({languages.length}/{maxLanguages})
                </span>
            </div>
            <p className="text-12 text-muted-foreground mt-0.5">
                Languages you can communicate in when collaborating on boards or meeting travelers.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
                {languages.map((lang) => (
                    <span
                        key={lang}
                        className="border-line bg-faint text-12 text-foreground font-body flex items-center gap-1.5 rounded-[2px] border px-2.5 py-1 font-medium"
                    >
                        {lang}
                        <button
                            type="button"
                            onClick={() => handleRemoveLanguage(lang)}
                            aria-label={`Remove ${lang}`}
                            className="text-muted-foreground hover:text-foreground cursor-pointer text-xs"
                        >
                            ✕
                        </button>
                    </span>
                ))}
            </div>

            <div className="mt-4 flex max-w-sm gap-2">
                <select
                    aria-label="Add language"
                    value={newLanguage}
                    disabled={languages.length >= maxLanguages}
                    onChange={(e) => setNewLanguage(e.target.value)}
                    className="border-line bg-background text-12 text-foreground placeholder:text-muted-foreground font-body focus:border-foreground flex-1 rounded-[2px] border px-3 py-1.5 transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <option value="">Choose a language</option>
                    {choices
                        .filter((choice) => !languages.includes(choice))
                        .map((choice) => (
                            <option key={choice} value={choice}>
                                {choice}
                            </option>
                        ))}
                </select>
                <button
                    type="button"
                    disabled={languages.length >= maxLanguages || !newLanguage.trim()}
                    onClick={handleAddLanguage}
                    className="border-line bg-background text-12 text-muted-foreground hover:text-foreground hover:border-foreground font-body cursor-pointer rounded-[2px] border px-3 py-1.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                    + Add
                </button>
            </div>
            {languages.length >= maxLanguages && (
                <p className="text-11 text-muted-foreground font-body mt-2">
                    Maximum of {maxLanguages} languages reached.
                </p>
            )}
        </div>
    );
}
