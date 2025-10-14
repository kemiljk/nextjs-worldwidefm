import { cosmic } from './cosmic-config';

export interface FormTexts {
  [sectionKey: string]: {
    title: string;
    descriptions: {
      [fieldKey: string]: string;
    };
  };
}

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

export function getDefaultFormTexts(): FormTexts {
  return {
    'show-details': {
      title: 'Show Details',
      descriptions: {},
    },
    'show-image': {
      title: 'Show Image',
      descriptions: {
        'upload-image':
          'Upload a square image (1:1 aspect ratio recommended) for your show. Maximum file size is 10MB. Accepts JPG, PNG, or WebP.',
      },
    },
    artist: {
      title: 'Artist',
      descriptions: {
        'artist-select': 'Select the main artist for this show or add a new one',
      },
    },
    'additional-information': {
      title: 'Additional Information',
      descriptions: {
        genres: 'Select genres to categorize this show',
        tracklist: 'Add each track on a new line in the format: Artist - Track Title',
      },
    },
    location: {
      title: 'Location',
      descriptions: {
        'location-select': 'Select a location for this show',
      },
    },
    'media-file': {
      title: 'Media File',
      descriptions: {
        'upload-audio':
          'Upload your show as an audio file (MP3, WAV, M4A, AAC, FLAC). Maximum file size is 600MB.',
      },
    },
  };
}
