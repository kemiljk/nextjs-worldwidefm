import { cosmic } from './cosmic-config';
import type { FormTexts } from './form-text-defaults';

export async function getFormTexts(): Promise<FormTexts> {
  try {
    const response = await cosmic.objects.findOne({
      type: 'add-show-form',
      slug: 'add-show-form',
    });

    if (!response?.object) {
      console.warn('Add Show Form singleton not found in Cosmic');
      return {};
    }

    const metadata = response.object.metadata || {};

    // Map the flat Cosmic structure to our nested structure
    return {
      'show-details': {
        title: metadata.show_details_title || 'Show Details',
        descriptions: {},
      },
      'show-image': {
        title: metadata.show_image_title || 'Show Image',
        descriptions: {
          'upload-image': metadata.upload_image_description || '',
        },
      },
      artist: {
        title: metadata.artist_title || 'Artist',
        descriptions: {
          'artist-select': metadata.artist_select_description || '',
        },
      },
      'additional-information': {
        title: metadata.additional_information_title || 'Additional Information',
        descriptions: {
          genres: metadata.genres_description || '',
          tracklist: metadata.tracklist_description || '',
        },
      },
      location: {
        title: metadata.location_title || 'Location',
        descriptions: {
          'location-select': metadata.location_select_description || '',
        },
      },
      'media-file': {
        title: metadata.media_file_title || 'Media File',
        descriptions: {
          'upload-audio': metadata.upload_audio_description || '',
        },
      },
    };
  } catch (error) {
    console.error('Error fetching form texts:', error);
    return {};
  }
}
