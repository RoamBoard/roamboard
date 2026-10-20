type HeadingFit = { fontSize: number; lines: string[] };
type Partition = { lines: string[]; widest: number; unevenness: number };
const continuations = new Set(["AND", "OF", "DE", "DEL", "DA", "DO", "DOS", "DAS"]);

// Destination artwork only: widths are measured in the actual display font at 100px, including its tracking.
export function fitDestinationHeading(
    name: string,
    width: number,
    height: number,
    measure: (text: string) => number
): HeadingFit {
    const text = name.trim().replace(/\s+/gu, " ").toUpperCase();
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || !text)
        return { fontSize: 0, lines: text ? [text] : [] };

    function compose(parts: string[], separator: string, emergency = false, maxLines = 3): HeadingFit {
        const cache = new Map<string, Partition | null>();
        function partition(end: number, count: number): Partition | null {
            if (!count) return end === 0 ? { lines: [], widest: 0, unevenness: 0 } : null;
            const key = `${end}:${count}`;
            if (cache.has(key)) return cache.get(key)!;
            const candidates = Array.from({ length: end }, (_, start) => {
                const previous = partition(start, count - 1);
                if (!previous) return null;
                const line = parts.slice(start, end).join(separator).trim();
                if (!line || (emergency && parts.slice(start, end).filter((part) => part.trim()).length < 3))
                    return null;
                // Keep small connecting words with the phrase they introduce, rather than a giant orphan "AND"/"DE".
                if (
                    !emergency &&
                    parts.length > 1 &&
                    (continuations.has(line) || (end < parts.length && continuations.has(parts[end - 1])))
                )
                    return null;
                const measured = measure(line);
                if (!Number.isFinite(measured) || measured < 0) return null;
                return {
                    lines: [...previous.lines, line],
                    widest: Math.max(previous.widest, measured),
                    unevenness: previous.unevenness + measured * measured
                };
            }).filter((candidate): candidate is Partition => candidate !== null);
            const best = candidates.reduce<Partition | null>(
                (best, candidate) =>
                    !best ||
                    candidate.widest < best.widest - 0.01 ||
                    (Math.abs(candidate.widest - best.widest) < 0.01 && candidate.unevenness < best.unevenness)
                        ? candidate
                        : best,
                null
            );
            cache.set(key, best);
            return best;
        }
        return Array.from({ length: Math.min(maxLines, parts.length) }, (_, index) =>
            partition(parts.length, index + 1)
        )
            .filter((candidate): candidate is Partition => candidate !== null)
            .reduce<HeadingFit>(
                (best, candidate) => {
                    const size = Math.min(
                        96,
                        (Math.max(0, width - 2) / Math.max(1, candidate.widest)) * 100,
                        Math.max(0, height - 2) / (candidate.lines.length * 0.9)
                    );
                    // Quarter pixels avoid iterative layout fitting and leave a small optical safety margin.
                    const fontSize = Math.floor(size * 4) / 4;
                    return fontSize > best.fontSize + 0.5 ? { fontSize, lines: candidate.lines } : best;
                },
                { fontSize: 0, lines: [text] }
            );
    }

    const words = compose(text.split(" "), " ");
    const graphemes = Array.from(
        new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
        (s) => s.segment
    );
    if (text.includes(" ") || graphemes.length < 12 || words.fontSize === 96) return words;
    // Long single words use a deliberate two-line lockup rather than a thin, tiny strip across the artwork.
    // Three lines are reserved for names that still cannot reach a readable display size in two.
    const twoLines = compose(graphemes, "", true, 2);
    const compact = twoLines.fontSize >= 22 ? twoLines : compose(graphemes, "", true);
    return compact.fontSize > words.fontSize + 0.5 ? compact : words;
}
