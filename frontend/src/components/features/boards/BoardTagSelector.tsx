import { boardTags } from "@/data/board-tags";
import TagIcon from "@/components/ui/TagIcon";

export default function BoardTagSelector() {
    return (
        <fieldset aria-describedby="board-tags-help" className="border-line rounded border p-4">
            <legend className="px-2">Tags (optional)</legend>
            <p id="board-tags-help" className="text-14 mb-4">
                Choose the vibes that describe your Board.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {boardTags.map((tag) => (
                    <label key={tag.id} className="relative cursor-pointer">
                        <input type="checkbox" name="tagIds" value={tag.id} className="peer sr-only" />
                        <span className="border-line peer-checked:border-foreground peer-checked:bg-faint peer-focus-visible:outline-foreground text-14 flex min-h-12 items-center gap-3 rounded border px-3 py-2 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 motion-reduce:transition-none">
                            <TagIcon tag={tag} className="shrink-0" />
                            {tag.name}
                        </span>
                    </label>
                ))}
            </div>
        </fieldset>
    );
}
