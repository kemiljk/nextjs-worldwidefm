# Form Texts Setup Guide

This guide explains how to set up the `form-texts` object type in Cosmic CMS to make the Add Show form text editable.

## 1. Create the Object Type in Cosmic

1. Go to your Cosmic CMS dashboard
2. Navigate to **Settings** → **Object Types**
3. Click **Add Object Type**
4. Configure the object type:
   - **Title**: `Form Texts`
   - **API Type Name**: `form-texts`
   - **Singleton**: No
   - **Icon**: 📝 (optional)

## 2. Add Metafields

Add the following metafields to the `form-texts` object type:

### Metafield 1: Section Key

- **Title**: `Section Key`
- **Key**: `section_key`
- **Type**: Text
- **Required**: Yes
- **Help Text**: Unique identifier for the form section (e.g., "show-details", "artist")

### Metafield 2: Section Title

- **Title**: `Section Title`
- **Key**: `section_title`
- **Type**: Text
- **Required**: Yes
- **Help Text**: Display title for the section (e.g., "Show Details", "Artist")

### Metafield 3: Field Descriptions

- **Title**: `Field Descriptions`
- **Key**: `field_descriptions`
- **Type**: Repeater
- **Required**: No

#### Repeater Fields:

1. **Field Key**

   - Key: `field_key`
   - Type: Text
   - Help Text: Field identifier (e.g., "upload-image", "artist-select")

2. **Description**
   - Key: `description`
   - Type: Textarea
   - Help Text: Description text shown to users

## 3. Create Form Text Objects

Create the following objects in Cosmic with the `form-texts` type:

### Object 1: Show Details

- **Title**: `Show Details Section`
- **section_key**: `show-details`
- **section_title**: `Show Details`
- **field_descriptions**: (empty)

### Object 2: Show Image

- **Title**: `Show Image Section`
- **section_key**: `show-image`
- **section_title**: `Show Image`
- **field_descriptions**:
  - field_key: `upload-image`
  - description: `Upload a square image (1:1 aspect ratio recommended) for your show. Maximum file size is 10MB. Accepts JPG, PNG, or WebP.`

### Object 3: Artist

- **Title**: `Artist Section`
- **section_key**: `artist`
- **section_title**: `Artist`
- **field_descriptions**:
  - field_key: `artist-select`
  - description: `Select the main artist for this show or add a new one`

### Object 4: Additional Information

- **Title**: `Additional Information Section`
- **section_key**: `additional-information`
- **section_title**: `Additional Information`
- **field_descriptions**:
  - field_key: `genres`
  - description: `Select genres to categorize this show`
  - field_key: `tracklist`
  - description: `Add each track on a new line in the format: Artist - Track Title`

### Object 5: Location

- **Title**: `Location Section`
- **section_key**: `location`
- **section_title**: `Location`
- **field_descriptions**:
  - field_key: `location-select`
  - description: `Select a location for this show`

### Object 6: Media File

- **Title**: `Media File Section`
- **section_key**: `media-file`
- **section_title**: `Media File`
- **field_descriptions**:
  - field_key: `upload-audio`
  - description: `Upload your show as an audio file (MP3, WAV, M4A, AAC, FLAC). Maximum file size is 600MB.`

## 4. Verify Setup

Once all objects are created:

1. The form will automatically fetch these texts from `/api/form-texts`
2. You can now edit section titles and field descriptions directly in Cosmic
3. Changes will appear on the Add Show form after the 5-minute cache expires
4. If texts aren't found in Cosmic, the form falls back to hardcoded defaults

## 5. Optional: Force Cache Refresh

To see changes immediately during testing:

- Restart your development server
- Or wait 5 minutes for the API cache to expire (revalidate = 300 seconds)
