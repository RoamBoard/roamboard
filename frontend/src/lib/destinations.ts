export type Destination = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  placeType: string;
  context: string[];
  country: string | null;
  countryCode: string | null;
  city: string | null;
};

export type DestinationContext = {
  destination: Destination;
  weather?: {
    timezone: string;
    dates: string[];
    minimums: number[];
    maximums: number[];
    precipitation: number[];
  };
  article?: {
    title: string;
    description: string;
    url: string;
    thumbnailUrl?: string;
  };
  image?: {
    id: string;
    url: string;
    alt: string;
    photographer: string;
    photographerUrl: string;
    sourceUrl: string;
  };
  unavailable: string[];
};

const apiOrigin = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${apiOrigin}${path}`, { signal });
  const body = (await response.json()) as { data?: T; error?: { message?: string } };
  if (!response.ok || body.data === undefined) {
    throw new Error(body.error?.message ?? "The Roamboard API could not complete that request.");
  }
  return body.data;
}

export function searchDestinations(query: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ q: query, limit: "6" });
  return request<Destination[]>(`/api/v1/destinations/search?${params.toString()}`, signal);
}

export function loadDestinationContext(destination: Destination, signal?: AbortSignal) {
  const params = new URLSearchParams({
    id: destination.id,
    name: destination.name,
    address: destination.address,
    latitude: String(destination.latitude),
    longitude: String(destination.longitude),
    placeType: destination.placeType,
  });
  return request<DestinationContext>(`/api/v1/destinations/context?${params.toString()}`, signal);
}
