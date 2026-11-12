export interface FormTexts {
  [sectionKey: string]: {
    title: string;
    descriptions: {
      [fieldKey: string]: string;
    };
  };
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
