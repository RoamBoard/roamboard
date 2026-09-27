export type NormalizedPhotoMetadata = {
  capturedAt: string | null;
  camera: string | null;
  orientation: string | null;
  latitude: number | null;
  longitude: number | null;
  hasGps: boolean;
  raw: Record<string, unknown>;
};

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function coordinate(value: unknown, reference: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const direct = Number(value);
  if (Number.isFinite(direct)) return direct;

  const parts = value.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (parts.length === 0 || parts.some((part) => !Number.isFinite(part))) return null;
  const absolute = Math.abs(parts[0]) + (parts[1] ?? 0) / 60 + (parts[2] ?? 0) / 3600;
  const referenceDirection = text(reference)?.toUpperCase();
  const valueDirection = value.match(/\b([NSEW])\s*$/i)?.[1].toUpperCase();
  const direction = referenceDirection?.startsWith("N") ? "N"
    : referenceDirection?.startsWith("S") ? "S"
      : referenceDirection?.startsWith("E") ? "E"
        : referenceDirection?.startsWith("W") ? "W"
          : valueDirection;
  return direction === "S" || direction === "W" || parts[0] < 0 ? -absolute : absolute;
}

export function normalizePhotoMetadata(value: unknown): NormalizedPhotoMetadata {
  const raw = objectValue(value);
  const gps = objectValue(raw.gps ?? raw.GPS);
  const latitude = coordinate(
    gps.latitude ?? gps.Latitude ?? raw.GPSLatitude,
    gps.latitude_ref ?? gps.LatitudeRef ?? raw.GPSLatitudeRef,
  );
  const longitude = coordinate(
    gps.longitude ?? gps.Longitude ?? raw.GPSLongitude,
    gps.longitude_ref ?? gps.LongitudeRef ?? raw.GPSLongitudeRef,
  );
  const make = text(raw.Make ?? raw.make);
  const model = text(raw.Model ?? raw.model);

  return {
    capturedAt: text(raw.DateTimeOriginal ?? raw.CreateDate ?? raw.DateCreated ?? raw.ModifyDate),
    camera: [make, model].filter(Boolean).join(" ") || null,
    orientation: text(raw.Orientation ?? raw.orientation),
    latitude,
    longitude,
    hasGps: latitude !== null && longitude !== null,
    raw,
  };
}