import { Fragment } from "react";

// Prefer identity separators. Long unbroken runs also need normal wrap opportunities:
// overflow-wrap alone cannot balance an emergency break and can orphan one glyph.
export default function ProfileIdentityText({ text }: { text: string }) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    const parts = text.split(/(?<=[\s_.-])/u);
    return parts.map((part, partIndex) => {
        const glyphs = Array.from(segmenter.segment(part), ({ segment }) => segment);
        const chunkCount = Math.floor(glyphs.length / 2);
        const chunks =
            glyphs.length > 10
                ? Array.from({ length: chunkCount }, (_, index) =>
                      glyphs.slice(index * 2, index === chunkCount - 1 ? undefined : index * 2 + 2).join("")
                  )
                : [part];
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
