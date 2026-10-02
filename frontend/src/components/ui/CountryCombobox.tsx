"use client";

import { useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { findCountry, suggestCountries, type Country } from "@/lib/countries";

type CountryComboboxProps = {
  value: string;
  onChange: (value: string, country: Country | null) => void;
  inputClassName: string;
};

export default function CountryCombobox({ value, onChange, inputClassName }: CountryComboboxProps) {
  const listboxId = useId();
  const container = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const suggestions = suggestCountries(value);
  const exactCountry = findCountry(value);

  function select(country: Country) {
    onChange(country.name, country);
    setOpen(false);
    setActiveIndex(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && suggestions.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => open ? (current + 1) % suggestions.length : 0);
    } else if (event.key === "ArrowUp" && suggestions.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => open ? (current - 1 + suggestions.length) % suggestions.length : suggestions.length - 1);
    } else if (event.key === "Enter" && open && suggestions[activeIndex]) {
      event.preventDefault();
      select(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return <div
    className="relative"
    ref={container}
    onBlur={(event) => {
      if (!container.current?.contains(event.relatedTarget)) setOpen(false);
    }}
  >
    <input
      className={inputClassName}
      value={value}
      onChange={(event) => {
        const nextValue = event.target.value;
        onChange(nextValue, findCountry(nextValue) ?? null);
        setOpen(true);
        setActiveIndex(0);
      }}
      onFocus={() => setOpen(true)}
      onKeyDown={handleKeyDown}
      placeholder="Denmark"
      autoComplete="off"
      required
      role="combobox"
      aria-autocomplete="list"
      aria-controls={listboxId}
      aria-expanded={open && suggestions.length > 0}
      aria-activedescendant={open && suggestions[activeIndex] ? `${listboxId}-${suggestions[activeIndex].code}` : undefined}
      aria-invalid={Boolean(value.trim()) && !exactCountry}
      aria-describedby={`${listboxId}-help`}
    />
    <span id={`${listboxId}-help`} className="sr-only">Choose an existing country from the suggestions.</span>
    {open && suggestions.length ? <ul id={listboxId} role="listbox" className="absolute z-20 mt-1 max-h-56 w-full overflow-auto border border-line bg-background shadow-lg">
      {suggestions.map((country, index) => <li key={country.code}>
        <button
          id={`${listboxId}-${country.code}`}
          type="button"
          role="option"
          aria-selected={country.code === exactCountry?.code}
          className={`flex w-full items-center justify-between px-4 py-3 text-left text-14 hover:bg-faint focus:bg-faint focus:outline-none${index === activeIndex ? " bg-faint" : ""}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => select(country)}
        >
          <span>{country.name}</span><span className="text-11 text-graphite">{country.code}</span>
        </button>
      </li>)}
    </ul> : null}
    {open && value.trim() && !suggestions.length ? <p className="absolute z-20 mt-1 w-full border border-line bg-background px-4 py-3 text-13 text-graphite" role="status">No country found. Check the spelling.</p> : null}
  </div>;
}
