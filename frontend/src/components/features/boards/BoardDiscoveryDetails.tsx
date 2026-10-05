"use client";

import TokenField from "@/components/features/boards/TokenField";
import { tagSuggestions, vibeSuggestions } from "@/lib/board-options";
import type { BoardVisibility } from "@/types/board";

type Props = {
  tags: string[];
  vibes: string[];
  highlights: string[];
  suggestedHighlights: string[];
  visibility: BoardVisibility;
  onTagsChange: (values: string[]) => void;
  onVibesChange: (values: string[]) => void;
  onHighlightsChange: (values: string[]) => void;
  onVisibilityChange: (visibility: BoardVisibility) => void;
};

export default function BoardDiscoveryDetails({
  tags,
  vibes,
  highlights,
  suggestedHighlights,
  visibility,
  onTagsChange,
  onVibesChange,
  onHighlightsChange,
  onVisibilityChange,
}: Props) {
  return (
    <div className="grid gap-14">
      <TokenField id="board-tags" label="Tags" values={tags} placeholder="Search or write a tag +" suggestions={tagSuggestions} onChange={onTagsChange} />

      <TokenField id="board-vibes" label="Vibe" values={vibes} placeholder="Search vibes +" maximum={3} suggestions={vibeSuggestions} allowCustom={false} onChange={onVibesChange} />

      <div>
        <TokenField id="board-highlights" label="Highlights" values={highlights} placeholder="add highlight +" onChange={onHighlightsChange} />
        {suggestedHighlights.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-12 text-graphite">
            <span>Suggested from pins:</span>
            {suggestedHighlights.filter((item) => !highlights.includes(item)).slice(0, 6).map((item) => <button key={item} type="button" onClick={() => onHighlightsChange([...highlights, item])} className="border-b border-line pb-1 hover:border-foreground">＋ {item}</button>)}
          </div>
        ) : null}
      </div>

      <fieldset>
        <legend className="font-display text-20 font-bold">Visibility</legend>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {([
            ["private", "Private", "Only you can see this"],
            ["friends", "Friends", "Visible to you and your friends"],
            ["public", "Public", "Discoverable by everyone"],
          ] as const).map(([value, label, description]) => (
            <label key={value} className={`cursor-pointer border p-4 ${visibility === value ? "border-foreground" : "border-line"}`}>
              <input type="radio" name="visibility" value={value} checked={visibility === value} onChange={() => onVisibilityChange(value)} className="sr-only" />
              <strong className="block text-13 font-medium">{label}</strong>
              <span className="mt-1 block text-10 text-graphite">{description}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
