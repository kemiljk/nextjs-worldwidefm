import { createBucketClient } from '@cosmicjs/sdk';

const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || '',
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY || '',
  writeKey: process.env.COSMIC_WRITE_KEY || '',
});

async function setupFormTexts() {
  console.log('🚀 Setting up Add Show Form in Cosmic...\n');

  try {
    // Step 1: Create the object type
    console.log('📝 Creating object type...');
    const objectType = await cosmic.objectTypes.insertOne({
      title: 'Add Show Form',
      slug: 'add-show-form',
      singular: 'Add Show Form',
      singleton: true,
      emoji: '📝',
      metafields: [
        // Show Details Section
        {
          type: 'text',
          title: 'Show Details Title',
          key: 'show_details_title',
          value: 'Show Details',
        },
        // Show Image Section
        {
          type: 'text',
          title: 'Show Image Title',
          key: 'show_image_title',
          value: 'Show Image',
        },
        {
          type: 'textarea',
          title: 'Upload Image Description',
          key: 'upload_image_description',
          value:
            'Upload a square image (1:1 aspect ratio recommended) for your show. Maximum file size is 10MB. Accepts JPG, PNG, or WebP.',
        },
        // Artist Section
        {
          type: 'text',
          title: 'Artist Title',
          key: 'artist_title',
          value: 'Artist',
        },
        {
          type: 'textarea',
          title: 'Artist Select Description',
          key: 'artist_select_description',
          value: 'Select the main artist for this show or add a new one',
        },
        // Additional Information Section
        {
          type: 'text',
          title: 'Additional Information Title',
          key: 'additional_information_title',
          value: 'Additional Information',
        },
        {
          type: 'textarea',
          title: 'Genres Description',
          key: 'genres_description',
          value: 'Select genres to categorize this show',
        },
        {
          type: 'textarea',
          title: 'Tracklist Description',
          key: 'tracklist_description',
          value: 'Add each track on a new line in the format: Artist - Track Title [Record Label]',
        },
        // Location Section
        {
          type: 'text',
          title: 'Location Title',
          key: 'location_title',
          value: 'Location',
        },
        {
          type: 'textarea',
          title: 'Location Select Description',
          key: 'location_select_description',
          value: 'Select a location for this show',
        },
        // Media File Section
        {
          type: 'text',
          title: 'Media File Title',
          key: 'media_file_title',
          value: 'Media File',
        },
        {
          type: 'textarea',
          title: 'Upload Audio Description',
          key: 'upload_audio_description',
          value:
            'Upload your show as an audio file (MP3, WAV, M4A, AAC, FLAC). Maximum file size is 600MB.',
        },
      ],
    });

    console.log('✅ Object type created successfully!\n');

    // Step 2: Create the singleton object with default values
    console.log('📄 Creating singleton object with default values...');
    const formObject = await cosmic.objects.insertOne({
      type: 'add-show-form',
      title: 'Add Show Form',
      slug: 'add-show-form',
      metadata: {
        show_details_title: 'Show Details',
        show_image_title: 'Show Image',
        upload_image_description:
          'Upload a square image (1:1 aspect ratio recommended) for your show. Maximum file size is 10MB. Accepts JPG, PNG, or WebP.',
        artist_title: 'Artist',
        artist_select_description: 'Select the main artist for this show or add a new one',
        additional_information_title: 'Additional Information',
        genres_description: 'Select genres to categorize this show',
        tracklist_description:
          'Add each track on a new line in the format: Artist - Track Title [Record Label]',
        location_title: 'Location',
        location_select_description: 'Select a location for this show',
        media_file_title: 'Media File',
        upload_audio_description:
          'Upload your show as an audio file (MP3, WAV, M4A, AAC, FLAC). Maximum file size is 600MB.',
      },
    });

    console.log('✅ Singleton object created successfully!\n');

    console.log('🎉 Setup complete!');
    console.log('\nYou can now edit the form text in Cosmic CMS:');
    console.log(
      `https://app.cosmicjs.com/${process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG}/objects/${formObject.object.id}`
    );
  } catch (error: any) {
    console.error('❌ Error setting up form texts:', error);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

setupFormTexts();
