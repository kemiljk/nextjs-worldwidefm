# Enhanced Show Pages & Host Profiles

This update introduces enhanced show detail pages that merge Mixcloud and Cosmic CMS data, plus host profile pages.

## Features Added

### 1. Enhanced Show Detail Pages

The show detail pages now merge data from:

- **Mixcloud API**: Basic show info, images, tags, hosts
- **Cosmic CMS**: Rich metadata including descriptions, tracklist, body text, genres, locations, takeovers

#### Enhanced Data Fields

- `enhanced_image`: Prefers Cosmic CMS image over Mixcloud
- `enhanced_genres`: Merges Mixcloud tags with Cosmic genres
- `enhanced_hosts`: Merges Mixcloud hosts with Cosmic regular_hosts
- `body_text`: Rich description text from Cosmic
- `tracklist`: Show tracklist from Cosmic
- `locations`: Location tags from Cosmic
- `takeovers`: Takeover information from Cosmic
- `broadcast_time`, `duration`: Additional scheduling info

### 2. Host Profile Pages

New host profile pages at `/hosts/[slug]` that display:

- Host image and description
- List of shows hosted by the person
- Auto-generated from Cosmic CMS hosts data

#### Key Files

- `app/hosts/[slug]/page.tsx` - Host profile page
- `components/host-link.tsx` - Smart host linking component
- `lib/cosmic-service.ts` - New host data fetching functions

### 3. Enhanced Show Page Features

#### New Sections

- **About This Show**: Displays `body_text` from Cosmic CMS
- **Tracklist**: Shows formatted tracklist if available
- **Enhanced Hosts**: Clickable host links to profiles
- **Locations**: Shows location tags from Cosmic
- **Takeovers**: Displays takeover information
- **Enhanced Genres**: Merges Mixcloud tags with Cosmic genres

#### Host Linking

- Schedule entries now link to host profiles
- Show pages have clickable host links
- Smart linking checks if host profile exists

## Data Flow

1. `getEnhancedShowBySlug()` fetches both Mixcloud and Cosmic data
2. Data is merged with Cosmic taking priority for rich content
3. Show page displays enhanced information
4. Host links route to profile pages when available

## API Functions

### New Functions in `lib/actions.ts`

- `getEnhancedShowBySlug(slug)` - Gets merged show data
- `getHostProfileUrl(hostName)` - Gets host profile URL if exists

### New Functions in `lib/cosmic-service.ts`

- `getHosts(params)` - Gets all hosts
- `getHostBySlug(slug)` - Gets single host by slug
- `getHostByName(name)` - Gets host by name search

## Usage Examples

### Enhanced Show Data

```typescript
const show = await getEnhancedShowBySlug("show-slug");
// Now has merged Mixcloud + Cosmic data
console.log(show.enhanced_image); // Preferred image
console.log(show.body_text); // Rich description
console.log(show.tracklist); // Show tracklist
```

### Host Linking

```tsx
import { HostLink } from "@/components/host-link";

// Smart host link that checks if profile exists
<HostLink hostName="DJ Name" className="text-blue-500 hover:underline" />;
```

## Benefits

1. **Richer Content**: Show pages display more detailed information
2. **Better SEO**: Enhanced metadata and descriptions
3. **User Discovery**: Host profiles help users find more shows
4. **Consistent Data**: Merges multiple data sources seamlessly
5. **Future-Ready**: Structure supports adding more content types
