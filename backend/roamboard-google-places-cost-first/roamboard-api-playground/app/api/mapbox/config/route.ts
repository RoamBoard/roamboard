import { missingEnv } from "@/lib/http";

export async function GET() {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return missingEnv("MAPBOX_ACCESS_TOKEN");

  // Mapbox GL JS always needs a public pk.* token in the browser.
  // Never put a secret sk.* token in this variable.
  if (!token.startsWith("pk.")) {
    return Response.json(
      { error: "MAPBOX_ACCESS_TOKEN must be a public pk.* token for this browser map prototype." },
      { status: 400 },
    );
  }

  return Response.json({ token });
}
