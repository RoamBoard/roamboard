export interface DestinationResult {
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
}

export interface DestinationWeather {
  timezone: string;
  dates: string[];
  minimums: number[];
  maximums: number[];
  precipitation: number[];
}

export interface DestinationArticle {
  title: string;
  description: string;
  url: string;
  thumbnailUrl?: string;
}

export interface DestinationImage {
  id: string;
  url: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
  sourceUrl: string;
}

export interface DestinationContext {
  destination: DestinationResult;
  weather?: DestinationWeather;
  article?: DestinationArticle;
  image?: DestinationImage;
  unavailable: string[];
}
