"use client";

import * as exifr from "exifr";
import { ChangeEvent, useState } from "react";

type ImportedPhoto = {
  fileName: string;
  capturedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  camera: string | null;
  place: string | null;
  rawExif: Record<string, unknown> | null;
};

const dateString = (value: unknown) =>
  value instanceof Date ? value.toISOString() : typeof value === "string" ? value : null;

export function PhotoMetadataTester() {
  const [photos, setPhotos] = useState<ImportedPhoto[]>([]);
  const [status, setStatus] = useState("No photos selected.");

  const parseOne = async (file: File): Promise<ImportedPhoto> => {
    const [metadata, gps] = await Promise.all([
      exifr.parse(file, ["DateTimeOriginal", "CreateDate", "Make", "Model"]),
      exifr.gps(file).catch(() => undefined),
    ]);

    const latitude = typeof gps?.latitude === "number" ? gps.latitude : null;
    const longitude = typeof gps?.longitude === "number" ? gps.longitude : null;
    const placeResponse =
      latitude !== null && longitude !== null
        ? await fetch(`/api/mapbox/reverse?latitude=${latitude}&longitude=${longitude}`)
        : null;
    const placeJson = placeResponse?.ok ? ((await placeResponse.json()) as { features?: Array<{ properties?: { full_address?: string; name?: string } }> }) : null;
    const firstFeature = placeJson?.features?.[0];

    return {
      fileName: file.name,
      capturedAt: dateString(metadata?.DateTimeOriginal ?? metadata?.CreateDate),
      latitude,
      longitude,
      camera: [metadata?.Make, metadata?.Model].filter(Boolean).join(" ") || null,
      place: firstFeature?.properties?.full_address ?? firstFeature?.properties?.name ?? null,
      rawExif: metadata ?? null,
    };
  };

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setStatus(`Reading ${files.length} photo${files.length === 1 ? "" : "s"} locally…`);

    const parsed = await Promise.all(files.map(parseOne));
    const sorted = [...parsed].sort((first, second) =>
      (first.capturedAt ?? "9999").localeCompare(second.capturedAt ?? "9999"),
    );
    setPhotos(sorted);
    setStatus(
      `${sorted.length} photos parsed. ${sorted.filter((photo) => photo.latitude !== null).length} contained GPS.`,
    );
  };

  return (
    <section className="card">
      <h2>Trip-photo EXIF import</h2>
      <p>
        Select original phone/camera files. They are parsed in your browser; only GPS coordinates are sent to the local Mapbox proxy for place names.
      </p>
      <input type="file" accept="image/*,.heic,.heif" multiple onChange={handleFiles} />
      <p className="muted">{status}</p>
      <div className="photo-list">
        {photos.map((photo) => (
          <article className="photo-item" key={photo.fileName}>
            <strong>{photo.fileName}</strong>
            <span>{photo.capturedAt ?? "No capture time"}</span><br />
            <span>{photo.place ?? "No GPS/place metadata"}</span><br />
            <span>{photo.camera ?? "Camera unknown"}</span>
          </article>
        ))}
      </div>
      {photos.length > 0 ? <pre>{JSON.stringify(photos, null, 2)}</pre> : null}
    </section>
  );
}
