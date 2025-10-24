'use server';

import { RadioCultArtist } from './radiocult-service';

// Base URL for the RadioCult API
const RADIOCULT_API_BASE_URL = 'https://api.radiocult.fm';

// Function to create a new artist in RadioCult if they don't exist
export async function createArtist(artistData: {
  name: string;
  description?: string;
  imageUrl?: string;
  socialLinks?: {
    instagram?: string;
    twitter?: string;
    facebook?: string;
    website?: string;
    mixcloud?: string;
    soundcloud?: string;
  };
}): Promise<RadioCultArtist | null> {
  try {
    // Get necessary environment variables
    const RADIOCULT_SECRET_KEY = process.env.RADIOCULT_SECRET_KEY;
    const STATION_ID = process.env.NEXT_PUBLIC_RADIOCULT_STATION_ID;

    if (!RADIOCULT_SECRET_KEY || !STATION_ID) {
      console.error('Missing RadioCult API credentials');
      throw new Error('Missing API credentials');
    }

    // Prepare the data for creating a new artist
    const createData: any = {
      name: artistData.name,
      description: artistData.description || `${artistData.name} - Artist`,
    };

    // Add socials if provided (using correct RadioCult field names)
    if (artistData.socialLinks && Object.keys(artistData.socialLinks).length > 0) {
      createData.socials = {};
      if (artistData.socialLinks.instagram)
        createData.socials.instagramHandle = artistData.socialLinks.instagram;
      if (artistData.socialLinks.twitter)
        createData.socials.twitterHandle = artistData.socialLinks.twitter;
      if (artistData.socialLinks.facebook)
        createData.socials.facebook = artistData.socialLinks.facebook;
      if (artistData.socialLinks.mixcloud)
        createData.socials.mixcloud = artistData.socialLinks.mixcloud;
      if (artistData.socialLinks.soundcloud)
        createData.socials.soundcloud = artistData.socialLinks.soundcloud;
      if (artistData.socialLinks.website) createData.socials.site = artistData.socialLinks.website;
    }

    // Note: Image/logo upload is not supported during artist creation
    // Images would need to be uploaded separately via the RadioCult UI or another endpoint

    // Send the creation request to RadioCult
    const response = await fetch(`${RADIOCULT_API_BASE_URL}/api/station/${STATION_ID}/artists`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': RADIOCULT_SECRET_KEY,
      },
      body: JSON.stringify(createData),
    });

    // Check if the creation was successful
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to create RadioCult artist:`, errorText);
      throw new Error(`API error: ${response.status} ${errorText}`);
    }

    // Parse the response
    const data = await response.json();

    if (!data.artist) {
      console.error('No artist in creation response:', data);
      throw new Error('Invalid response from API');
    }

    console.log(`Successfully created artist ${data.artist.id} - ${data.artist.name}`);
    return data.artist;
  } catch (error) {
    console.error(`Error creating artist:`, error);
    return null;
  }
}

// Function to check if an artist exists by name and create them if they don't
export async function findOrCreateArtist(
  name: string,
  details?: {
    description?: string;
    imageUrl?: string;
    socialLinks?: {
      instagram?: string;
      twitter?: string;
      facebook?: string;
      website?: string;
      mixcloud?: string;
      soundcloud?: string;
    };
  }
): Promise<RadioCultArtist | null> {
  try {
    // Get necessary environment variables
    const RADIOCULT_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_RADIOCULT_PUBLISHABLE_KEY;
    const STATION_ID = process.env.NEXT_PUBLIC_RADIOCULT_STATION_ID;

    if (!RADIOCULT_PUBLISHABLE_KEY || !STATION_ID) {
      console.error('Missing RadioCult API credentials');
      throw new Error('Missing API credentials');
    }

    // Try to find the artist by name
    const searchResponse = await fetch(
      `${RADIOCULT_API_BASE_URL}/api/station/${STATION_ID}/artists?search=${encodeURIComponent(name)}`,
      {
        headers: {
          'x-api-key': RADIOCULT_PUBLISHABLE_KEY,
        },
      }
    );

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error(`Failed to search for RadioCult artist:`, errorText);
      throw new Error(`API error: ${searchResponse.status} ${errorText}`);
    }

    const searchData = await searchResponse.json();

    // Check if we found an exact match
    const exactMatch = (searchData.artists || []).find(
      (artist: RadioCultArtist) => artist.name.toLowerCase() === name.toLowerCase()
    );

    if (exactMatch) {
      console.log(`Found existing artist: ${exactMatch.id} - ${exactMatch.name}`);
      return exactMatch;
    }

    // If no match found, create a new artist
    console.log(`No matching artist found for "${name}", creating new artist...`);
    return await createArtist({
      name,
      ...details,
    });
  } catch (error) {
    console.error(`Error finding or creating artist:`, error);
    return null;
  }
}
