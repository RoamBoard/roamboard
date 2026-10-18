// One combined mask preserves the original circuit geometry without 78 separate masked layers.
export default function CreatorUploadArtwork() {
    return (
        <div
            aria-hidden="true"
            className="bg-line pointer-events-none absolute inset-0"
            style={{ mask: "url('/images/create/smart-create-circuits.svg') center / 100% 100% no-repeat" }}
        />
    );
}
