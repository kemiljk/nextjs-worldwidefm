import { z } from 'zod';

export const LocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['city', 'country']),
  countryCode: z.string().optional(),
  region: z.string().optional(),
});

export type Location = z.infer<typeof LocationSchema>;

// Cache for cities data
const citiesCache: { [key: string]: Location[] } = {};

export async function getCountries(): Promise<Location[]> {
  const response = await fetch('https://restcountries.com/v3.1/all?fields=name,cca2');
  const data = await response.json();

  return data
    .map((country: any) => ({
      id: country.cca2,
      name: country.name.common,
      type: 'country' as const,
      countryCode: country.cca2,
    }))
    .sort((a: Location, b: Location) => a.name.localeCompare(b.name));
}

export async function getCities(countryCode?: string, name?: string): Promise<Location[]> {
  if (!countryCode) {
    return [];
  }

  // If we have cached cities for this country, use them
  if (citiesCache[countryCode]) {
    const cities = citiesCache[countryCode];
    if (!name) return cities;

    // Filter cities by name if provided
    const searchTerm = name.toLowerCase();
    return cities.filter(
      (city: Location) =>
        city.name.toLowerCase().includes(searchTerm) ||
        (city.region && city.region.toLowerCase().includes(searchTerm))
    );
  }

  try {
    // Get country name from country code
    const countryResponse = await fetch(`https://restcountries.com/v3.1/alpha/${countryCode}`);
    const countryData = await countryResponse.json();
    const countryName = countryData[0]?.name?.common;

    if (!countryName) {
      throw new Error('Could not find country name for code: ' + countryCode);
    }

    // Fetch cities from the free API with the correct request format
    const response = await fetch('https://countriesnow.space/api/v0.1/countries/cities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        country: countryName,
      }),
    });

    const data = await response.json();

    // Check if the response has the expected structure
    if (!data.data || !Array.isArray(data.data)) {
      console.error('Unexpected API response format:', data);
      throw new Error('Invalid response format from cities API');
    }

    // Transform the data to match our Location type
    const cities = data.data.map((cityName: string) => ({
      id: `${countryCode}-${cityName}`,
      name: cityName,
      type: 'city' as const,
      countryCode,
    }));

    // Cache the cities for this country
    citiesCache[countryCode] = cities;

    // Filter by name if provided
    if (name) {
      const searchTerm = name.toLowerCase();
      return cities.filter((city: Location) => city.name.toLowerCase().includes(searchTerm));
    }

    return cities;
  } catch (error) {
    console.error('Error fetching cities:', error);
    // If the API fails, try to use a fallback list of major cities
    const fallbackCities = getFallbackCities(countryCode);
    citiesCache[countryCode] = fallbackCities;

    if (name) {
      const searchTerm = name.toLowerCase();
      return fallbackCities.filter((city: Location) =>
        city.name.toLowerCase().includes(searchTerm)
      );
    }

    return fallbackCities;
  }
}

// Fallback list of major cities by country code
function getFallbackCities(countryCode: string): Location[] {
  const majorCities: { [key: string]: string[] } = {
    US: [
      'New York',
      'Los Angeles',
      'Chicago',
      'Houston',
      'Phoenix',
      'Philadelphia',
      'San Antonio',
      'San Diego',
      'Dallas',
      'San Jose',
    ],
    GB: [
      'London',
      'Manchester',
      'Birmingham',
      'Leeds',
      'Glasgow',
      'Liverpool',
      'Newcastle',
      'Sheffield',
      'Bristol',
      'Edinburgh',
    ],
    DE: [
      'Berlin',
      'Hamburg',
      'Munich',
      'Cologne',
      'Frankfurt',
      'Stuttgart',
      'Düsseldorf',
      'Leipzig',
      'Dortmund',
      'Essen',
    ],
    FR: [
      'Paris',
      'Marseille',
      'Lyon',
      'Toulouse',
      'Nice',
      'Nantes',
      'Strasbourg',
      'Montpellier',
      'Bordeaux',
      'Lille',
    ],
    IT: [
      'Rome',
      'Milan',
      'Naples',
      'Turin',
      'Palermo',
      'Genoa',
      'Bologna',
      'Florence',
      'Bari',
      'Catania',
    ],
    ES: [
      'Madrid',
      'Barcelona',
      'Valencia',
      'Seville',
      'Zaragoza',
      'Málaga',
      'Murcia',
      'Palma',
      'Las Palmas',
      'Bilbao',
    ],
    NL: [
      'Amsterdam',
      'Rotterdam',
      'The Hague',
      'Utrecht',
      'Eindhoven',
      'Tilburg',
      'Groningen',
      'Almere',
      'Breda',
      'Nijmegen',
    ],
    BE: [
      'Brussels',
      'Antwerp',
      'Ghent',
      'Charleroi',
      'Liège',
      'Bruges',
      'Namur',
      'Leuven',
      'Mons',
      'Aalst',
    ],
    // Add more countries as needed
  };

  const cities = majorCities[countryCode] || [];
  return cities.map(cityName => ({
    id: `${countryCode}-${cityName}`,
    name: cityName,
    type: 'city' as const,
    countryCode,
  }));
}
