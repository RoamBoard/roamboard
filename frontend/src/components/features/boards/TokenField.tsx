"use client";

import { useMemo, useState } from "react";

type Suggestion = string | { label: string; icon?: string };

type Props = {
  id: string;
  label: string;
  values: string[];
  placeholder: string;
  maximum?: number;
  suggestions?: Suggestion[];
  allowCustom?: boolean;
  onChange: (values: string[]) => void;
};

function suggestionLabel(value: Suggestion): string {
  return typeof value === "string" ? value : value.label;
}

export default function TokenField({ id, label, values, placeholder, maximum, suggestions = [], allowCustom = true, onChange }: Props) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const matches = useMemo(() => suggestions.filter((item) => {
    const candidate = suggestionLabel(item);
    return !values.some((value) => value.toLocaleLowerCase() === candidate.toLocaleLowerCase()) && candidate.toLocaleLowerCase().includes(input.trim().toLocaleLowerCase());
  }).slice(0, 8), [input, suggestions, values]);

  function addValue(raw = input) {
    const value = raw.trim().replace(/^#/, "");
    if (!value || values.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      setInput("");
      return;
    }
    if (!allowCustom && !suggestions.some((item) => suggestionLabel(item).toLocaleLowerCase() === value.toLocaleLowerCase())) return;
    if (maximum !== undefined && values.length >= maximum) return;
    onChange([...values, value]);
    setInput("");
  }

  const iconFor = (value: string) => {
    const match = suggestions.find((item) => suggestionLabel(item).toLocaleLowerCase() === value.toLocaleLowerCase());
    return typeof match === "object" ? match.icon : undefined;
  };

  return (
    <div>
      <label htmlFor={id} className="font-display text-20 font-bold">{label}</label>
      {maximum !== undefined ? <span className="ml-2 text-10 text-stone">up to {maximum}</span> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {values.map((value) => <span key={value} className="inline-flex items-center gap-2 border-l border-line px-3 py-2 text-12 text-graphite">{iconFor(value) ? <span aria-hidden="true">{iconFor(value)}</span> : null}{value}<button type="button" onClick={() => onChange(values.filter((item) => item !== value))} aria-label={`Remove ${value}`}>×</button></span>)}
        <div className="relative min-w-44 flex-1">
          <input id={id} value={input} disabled={maximum !== undefined && values.length >= maximum} onFocus={() => setFocused(true)} onBlur={() => { window.setTimeout(() => setFocused(false), 100); if (allowCustom) addValue(); }} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); const first = matches[0]; addValue(first && !allowCustom ? suggestionLabel(first) : input); } }} placeholder={placeholder} autoComplete="off" className="w-full border-b border-line bg-transparent px-2 py-2 text-13 text-foreground outline-none placeholder:text-stone focus:border-foreground disabled:cursor-not-allowed" />
          {focused && matches.length > 0 ? <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto border border-line bg-background shadow-xl" aria-label={`${label} suggestions`}>{matches.map((item) => { const value = suggestionLabel(item); const icon = typeof item === "object" ? item.icon : undefined; return <li key={value}><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => addValue(value)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-12 hover:bg-faint">{icon ? <span aria-hidden="true">{icon}</span> : null}{value}</button></li>; })}</ul> : null}
        </div>
      </div>
      {!allowCustom ? <p className="mt-2 text-10 text-stone">Search and select from the curated vocabulary.</p> : null}
    </div>
  );
}
