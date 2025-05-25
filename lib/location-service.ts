import { z } from "zod";

export const LocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["city", "country"]),
  countryCode: z.string().optional(),
  region: z.string().optional(),
});

export type Location = z.infer<typeof LocationSchema>;

export async function getCountries(): Promise<Location[]> {
  const response = await fetch("https://restcountries.com/v3.1/all?fields=name,cca2");
  const data = await response.json();

  return data
    .map((country: any) => ({
      id: country.cca2,
      name: country.name.common,
      type: "country" as const,
      countryCode: country.cca2,
    }))
    .sort((a: Location, b: Location) => a.name.localeCompare(b.name));
}

export async function getCities(countryCode?: string, name?: string): Promise<Location[]> {
  const apiKey = process.env.NEXT_PUBLIC_RAPIDAPI_KEY;

  if (!apiKey) {
    throw new Error("RapidAPI key not found. Please add NEXT_PUBLIC_RAPIDAPI_KEY to your environment variables.");
  }

  if (!countryCode || !name) {
    return [];
  }

  const url = `https://wft-geo-db.p.rapidapi.com/v1/geo/cities?namePrefix=${encodeURIComponent(name)}&countryIds=${encodeURIComponent(countryCode)}&sort=-population&limit=10`;

  try {
    const response = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": "wft-geo-db.p.rapidapi.com",
      },
    });

    if (!response.ok) {
      throw new Error(`GeoDB API error: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error("Invalid response format from GeoDB Cities API");
    }

    return data.data.map((city: any) => ({
      id: city.id,
      name: city.name,
      type: "city" as const,
      countryCode: city.countryCode,
      region: city.region,
    }));
  } catch (error) {
    console.error("Error fetching cities from GeoDB:", error);
    throw error;
  }
}
