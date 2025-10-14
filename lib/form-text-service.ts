import { cosmic } from './cosmic-config';

export interface FormTextSection {
  section_key: string;
  section_title: string;
  field_descriptions: Array<{
    field_key: string;
    description: string;
  }>;
}

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
    const response = await cosmic.objects
      .find({
        type: 'form-texts',
        status: 'published',
      })
      .props('slug,title,metadata')
      .limit(100)
      .depth(1);

    const sections = response.objects || [];

    const formTexts: FormTexts = {};

    sections.forEach((section: any) => {
      const metadata = section.metadata || {};
      const sectionKey = metadata.section_key || section.slug;
      const sectionTitle = metadata.section_title || section.title;
      const fieldDescriptions = metadata.field_descriptions || [];

      formTexts[sectionKey] = {
        title: sectionTitle,
        descriptions: {},
      };

      fieldDescriptions.forEach((field: any) => {
        if (field.field_key && field.description) {
          formTexts[sectionKey].descriptions[field.field_key] = field.description;
        }
      });
    });

    return formTexts;
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
