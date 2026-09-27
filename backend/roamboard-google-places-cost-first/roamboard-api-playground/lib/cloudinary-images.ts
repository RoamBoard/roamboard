import { v2 as cloudinary } from "cloudinary";

export type CloudinaryVariant = {
  id: "hero" | "card" | "square" | "portrait";
  label: string;
  width: number;
  height: number;
  url: string;
};

const VARIANTS = [
  { id: "hero", label: "Hero 16:9", width: 1200, height: 675 },
  { id: "card", label: "Card 4:3", width: 800, height: 600 },
  { id: "square", label: "Square 1:1", width: 800, height: 800 },
  { id: "portrait", label: "Portrait 3:4", width: 600, height: 800 },
] as const;

export function buildAutomaticVariants(publicId: string): CloudinaryVariant[] {
  return VARIANTS.map((variant) => ({
    ...variant,
    url: cloudinary.url(publicId, {
      secure: true,
      transformation: [
        { crop: "fill", gravity: "auto", width: variant.width, height: variant.height },
        { fetch_format: "auto", quality: "auto" },
      ],
    }),
  }));
}
