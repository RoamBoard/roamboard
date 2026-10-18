// Preserve the camera's calendar day and wall-clock time; EXIF often has no timezone.
function object(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}
function fraction(value: unknown): number {
    if (typeof value === "number") return value;
    if (typeof value !== "string") return NaN;
    const parts = value.split("/").map(Number);
    return parts.length === 2 ? parts[0]! / parts[1]! : Number(value);
}
function coordinate(value: unknown, reference: unknown, maximum: number): number | null {
    let parts: number[] = [];
    if (Array.isArray(value)) parts = value.map(fraction);
    else if (typeof value === "number") parts = [value];
    else if (typeof value === "string" && value.trim()) {
        parts = Number.isFinite(Number(value))
            ? [Number(value)]
            : (value.match(/-?\d+(?:\.\d+)?(?:\/\d+)?/g) ?? []).map(fraction);
    }
    if (!parts.length || parts.length > 3 || parts.some((part) => !Number.isFinite(part))) return null;
    if ((parts[1] ?? 0) < 0 || (parts[1] ?? 0) >= 60 || (parts[2] ?? 0) < 0 || (parts[2] ?? 0) >= 60) return null;
    const direction = String(reference ?? (typeof value === "string" ? value.match(/[NSEW]\s*$/i)?.[0] : "") ?? "")
        .trim()
        .toUpperCase();
    const absolute = Math.abs(parts[0]!) + (parts[1] ?? 0) / 60 + (parts[2] ?? 0) / 3600;
    if (absolute > maximum) return null;
    return direction === "S" || direction === "W" || parts[0]! < 0 ? -absolute : absolute;
}
export function photoCaptureDate(value: unknown): Date | null {
    if (typeof value !== "string") return null;
    const match = /^(\d{4})[:-](\d{2})[:-](\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/.exec(
        value.trim()
    );
    if (!match) return null;
    const canonical = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`;
    const date = new Date(canonical);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 19) === canonical.slice(0, 19) ? date : null;
}
export function cloudinaryPhotoMetadata(raw: Record<string, unknown>) {
    const meta = { ...object(raw.exif), ...object(raw.image_metadata), ...object(raw.media_metadata) };
    const gps = object(meta.gps ?? meta.GPS);
    const capturedAt =
        [meta.DateTimeOriginal, meta.DateTimeDigitized, meta.CreateDate, raw.taken_at, meta.DateTime]
            .map(photoCaptureDate)
            .find(Boolean) ?? null;
    return {
        capturedAt,
        latitude: coordinate(
            meta.GPSLatitude ?? gps.latitude ?? gps.Latitude ?? meta.latitude,
            meta.GPSLatitudeRef ?? gps.latitude_ref ?? gps.LatitudeRef,
            90
        ),
        longitude: coordinate(
            meta.GPSLongitude ?? gps.longitude ?? gps.Longitude ?? meta.longitude,
            meta.GPSLongitudeRef ?? gps.longitude_ref ?? gps.LongitudeRef,
            180
        )
    };
}
