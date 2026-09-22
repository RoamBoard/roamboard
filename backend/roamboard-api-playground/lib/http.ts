import { NextResponse } from "next/server";

export const missingEnv = (name: string) =>
  NextResponse.json(
    { error: `Missing ${name}. Add it to .env.local and restart npm run dev.` },
    { status: 503 },
  );

export const badRequest = (message: string) =>
  NextResponse.json({ error: message }, { status: 400 });

export const proxyJson = async (response: Response) => {
  const body: unknown = await response.json().catch(() => ({
    error: "The provider returned a non-JSON response.",
  }));

  return NextResponse.json(body, { status: response.status });
};

export const numberParam = (
  params: URLSearchParams,
  name: string,
  fallback: number,
) => {
  const raw = params.get(name);
  const parsed = raw === null ? fallback : Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};
