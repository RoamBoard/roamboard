type Props = { photographer?: string; photographerUrl?: string; sourceUrl?: string };

function referralLink(value: string) {
    return `${value}${value.includes("?") ? "&" : "?"}utm_source=roamboard&utm_medium=referral`;
}

// A separate credit is readable beside a masked photo or below the small collage images.
export default function DestinationPhotoCredit({ photographer, photographerUrl, sourceUrl }: Props) {
    if (!photographer) return null;
    return (
        <p className="text-muted-foreground text-[10px] leading-5">
            Photo by{" "}
            {photographerUrl ? (
                <a
                    href={referralLink(photographerUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4"
                >
                    {photographer}
                </a>
            ) : (
                photographer
            )}
            {sourceUrl ? (
                <>
                    {" "}
                    on{" "}
                    <a
                        href={referralLink(sourceUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-4"
                    >
                        Unsplash
                    </a>
                </>
            ) : null}
        </p>
    );
}
