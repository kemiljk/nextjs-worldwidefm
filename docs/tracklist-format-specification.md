# Tracklist Format Specification

## Overview

This document explains the exact format requirements for tracklists in the Worldwide FM system, how they are stored, and how they are rendered.

## Input Format (Add Show Form)

### User Input
- **Format**: Plain text, one track per line
- **Location**: `app/add-show/add-show-form.tsx` - Textarea field
- **Processing**: Newlines (`\n`) are automatically converted to HTML `<br />` tags before storage

### Supported Track Formats

The parser supports multiple separator formats (in order of precedence):

1. **Hyphen with spaces**: `Artist - Track [Record Label]`
   - Example: `Aphex Twin - Avril 14th [Warp Records]`
   - This is the **recommended format** and what the form description suggests
   - The record label in square brackets is optional
   - No additional hyphen is needed between the track and label

2. **Colon with space**: `Artist: Track Title`
   - Example: `Boards of Canada: Dayvan Cowboy`

3. **En dash with spaces**: `Artist – Track Title` (Unicode en dash U+2013)
   - Example: `Four Tet – She Just Likes to Fight`

4. **Forward slash with spaces**: `Artist / Track Title`
   - Example: `Burial / Archangel`

5. **Pipe with spaces**: `Artist | Track Title`
   - Example: `Flying Lotus | Zodiac Shit`

6. **No separator**: If no separator is found, the entire line is treated as the track title
   - Example: `Untitled Track` → Artist: "Unknown Artist", Title: "Untitled Track"

### Format Examples

```
Aphex Twin - Avril 14th [Warp Records]
Boards of Canada: Dayvan Cowboy
Four Tet – She Just Likes to Fight
Burial / Archangel
Flying Lotus | Zodiac Shit
```

## Storage Format (Cosmic CMS)

### Rich Text Field
- **Field Type**: Rich Text in Cosmic CMS
- **Storage Format**: HTML with `<br />` tags separating lines
- **Location**: `episode.metadata.tracklist`

### Storage Process
1. User enters plain text in the form (one track per line)
2. Form converts newlines to `<br />` tags: `values.tracklist.replace(/\n/g, '<br />')`
3. HTML is stored directly in Cosmic as Rich Text
4. Cosmic may add additional HTML formatting (e.g., `<p>` tags) if edited in the Rich Text editor

### Example Stored Format

```html
Aphex Twin - Avril 14th [Warp Records]<br />Boards of Canada: Dayvan Cowboy<br />Four Tet – She Just Likes to Fight
```

Or if edited in Cosmic Rich Text editor:
```html
<p>Aphex Twin - Avril 14th [Warp Records]</p><p>Boards of Canada: Dayvan Cowboy</p>
```

## Rendering Format (Episode Page)

### Parsing Algorithm
**Location**: `components/ui/tracklist.tsx`

The parser:
1. Normalizes HTML by converting `<br />`, `</p>`, and `</div>` tags to newlines
2. Removes remaining HTML tags
3. Splits content by newlines
4. For each line, attempts to parse using the separator formats (in order listed above)
5. Extracts artist and title, or treats entire line as title if no separator found

### Display Format
- **Layout**: Two-column table
  - Left column (30%): Artist name or "Unknown Artist"
  - Right column (70%): Track title
- **Styling**: Monospace font, uppercase, with borders between tracks

### Track Count
**Location**: `components/ui/tracklisttoggle.tsx`

The track count is calculated by:
1. Normalizing HTML (same as parsing)
2. Extracting text content
3. Splitting by newlines
4. Counting non-empty lines

## Common Issues and Solutions

### Issue: Inconsistent Track Counts
**Cause**: Track count was previously splitting by `\n` instead of parsing HTML
**Solution**: Fixed in `tracklisttoggle.tsx` - now properly parses HTML before counting

### Issue: Tracks Not Parsing Correctly
**Causes**:
- Cosmic Rich Text editor added `<p>` tags
- Missing or incorrect separator format
- Extra whitespace

**Solutions**:
- Parser now handles `<p>` and `<div>` tags
- Parser supports multiple separator formats
- Whitespace is trimmed automatically

### Issue: Tracks Showing as "Unknown Artist"
**Cause**: No separator found in the line
**Solution**: Ensure tracks use one of the supported separator formats, or accept that the line will be treated as title-only

## Technical Details

### Files Involved

1. **Input**: `app/add-show/add-show-form.tsx`
   - Lines 427-429: Converts newlines to `<br />` tags
   - Lines 877-897: Form field definition

2. **Storage**: `app/api/shows/create/route.ts`
   - Line 234: Stores tracklist directly in metadata

3. **Rendering**: `components/ui/tracklist.tsx`
   - Lines 17-90: Client-side parsing function
   - Lines 128-195: Server-side parsing function

4. **Display**: `components/ui/tracklisttoggle.tsx`
   - Lines 6-24: Track count calculation
   - Lines 18-22: Tracklist display toggle

5. **Page Integration**: `app/episode/[slug]/page.tsx`
   - Lines 249-278: Tracklist section with visibility logic

### Data Flow

```
User Input (Plain Text)
    ↓
Form Processing (Convert \n to <br />)
    ↓
API Storage (Store as HTML in Cosmic)
    ↓
Cosmic Rich Text Field (May add <p> tags)
    ↓
Retrieval (Get HTML from Cosmic)
    ↓
Parser (Normalize HTML, extract lines, parse format)
    ↓
Display (Render as two-column table)
```

## Best Practices

1. **Use the recommended format**: `Artist - Track [Record Label]`
   - The record label in square brackets is optional
   - No additional hyphen needed between track and label
2. **One track per line**: Don't use multiple tracks on the same line
3. **Consistent separators**: Use the same separator format throughout a tracklist
4. **Avoid editing in Cosmic**: If possible, avoid editing tracklists directly in Cosmic Rich Text editor to prevent HTML formatting issues
5. **Test parsing**: If tracks aren't displaying correctly, check the stored HTML format in Cosmic

## Future Improvements

Potential enhancements:
- Validation in the form to ensure proper format
- Preview of parsed tracks before submission
- Automatic format detection and normalization
- Support for timestamps (e.g., `00:00 Artist - Track Title`)

