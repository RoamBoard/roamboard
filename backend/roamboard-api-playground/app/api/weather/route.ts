import { numberParam, proxyJson } from "@/lib/http";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const latitude = numberParam(params, "latitude", 59.3293);
  const longitude = numberParam(params, "longitude", 18.0686);
  const upstream = new URL("https://api.open-meteo.com/v1/forecast");
  upstream.searchParams.set("latitude", String(latitude));
  upstream.searchParams.set("longitude", String(longitude));
  upstream.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
  );
  upstream.searchParams.set("timezone", "auto");
  upstream.searchParams.set("forecast_days", "7");

  const response = await fetch(upstream, { next: { revalidate: 1800 } });
  return proxyJson(response);
}
