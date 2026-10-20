import { Fragment } from "react";

// Prefer identity separators. Long unbroken runs also need normal wrap opportunities:
// overflow-wrap alone cannot balance an emergency break and can orphan one glyph.
export default function ProfileIdentityText({ text }: { text: string }) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    const parts = Array.from(segmenter.segment(text), ({ segment }) => segment)
        .reduce<string[][]>(
            (runs, glyph) => {
                runs[runs.length - 1].push(glyph);
                if (/^[\s_.-]/u.test(glyph)) runs.push([]);
                return runs;
            },
            [[]]
        )
        .filter((run) => run.length > 0);
    return parts.map((glyphs, partIndex) => {
        const chunkCount = Math.floor(glyphs.length / 2);
        const chunks =
            glyphs.length > 10
                ? Array.from({ length: chunkCount }, (_, index) =>
                      glyphs.slice(index * 2, index === chunkCount - 1 ? undefined : index * 2 + 2).join("")
                  )
                : [glyphs.join("")];
        return (
            <Fragment key={partIndex}>
                {chunks.map((chunk, index) => (
                    <Fragment key={index}>
                        {chunk}
                        {index < chunks.length - 1 && <wbr />}
                    </Fragment>
                ))}
                {partIndex < parts.length - 1 && <wbr />}
            </Fragment>
        );
    });
}
