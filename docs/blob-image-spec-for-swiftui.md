# Blob-Based Image System Specification

## Overview

WorldwideFM has migrated older media assets from Cosmic CMS to Vercel Blob storage for cost optimization. The SwiftUI app using CosmicSwiftSDK needs to be updated to handle this hybrid image storage approach.

## Summary of Changes

- **New Field**: `external_image_url` (String, optional) added to Cosmic object metadata
- **Image Priority**: Check `external_image_url` first, fall back to `image.imgix_url` or `image.url`
- **Storage Split**: ~1,000 most recent items stay on Cosmic ("hot storage"), older items migrate to Vercel Blob ("cold storage")
- **Affected Object Types**: `episode`, `regular-hosts`, `takeovers`, `posts`, `videos`, `events`, `genres`, `locations`, `about`

---

## Data Model Changes

### New Metadata Field

All Cosmic object types that contain images now have an optional `external_image_url` field in their metadata:

```json
{
  "metadata": {
    "image": {
      "url": "https://cdn.cosmicjs.com/.../image.jpg",
      "imgix_url": "https://imgix.cosmicjs.com/.../image.jpg"
    },
    "external_image_url": "https://xxx.public.blob.vercel-storage.com/cosmic-archive/image.jpg"
  }
}
```

### Field Details

| Field | Type | Description |
|-------|------|-------------|
| `external_image_url` | `String?` | Vercel Blob URL for cold storage images. Takes precedence over `image` when present. |
| `image.url` | `String?` | Original Cosmic CDN URL (may be deprecated for cold storage items) |
| `image.imgix_url` | `String?` | Cosmic imgix URL with transformation support (hot storage only) |

---

## Image Resolution Logic

### Priority Order (IMPORTANT)

When resolving an image URL, use this exact order:

1. **`external_image_url`** — If present, use this (Vercel Blob)
2. **`image.imgix_url`** — Cosmic imgix URL (supports on-the-fly transforms)
3. **`image.url`** — Raw Cosmic CDN URL
4. **Placeholder** — Local fallback image

### Swift Implementation

```swift
extension CosmicObject {
    /// Returns the best available image URL for the object
    var resolvedImageURL: URL? {
        // Priority 1: External blob storage (cold storage)
        if let externalURL = metadata?.externalImageURL,
           let url = URL(string: externalURL) {
            return url
        }
        
        // Priority 2: Cosmic imgix URL (hot storage, supports transforms)
        if let imgixURL = metadata?.image?.imgixURL,
           let url = URL(string: imgixURL) {
            return url
        }
        
        // Priority 3: Cosmic raw URL
        if let rawURL = metadata?.image?.url,
           let url = URL(string: rawURL) {
            return url
        }
        
        return nil
    }
}
```

### SwiftUI View Helper

```swift
struct CosmicImage: View {
    let object: CosmicObject
    var placeholder: String = "image-placeholder"
    
    var body: some View {
        AsyncImage(url: object.resolvedImageURL) { phase in
            switch phase {
            case .empty:
                ProgressView()
            case .success(let image):
                image
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            case .failure:
                Image(placeholder)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            @unknown default:
                Image(placeholder)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            }
        }
    }
}
```

---

## URL Patterns

### Vercel Blob URLs (Cold Storage)

Format: `https://{store-id}.public.blob.vercel-storage.com/cosmic-archive/{filename}`

Example:
```
https://xxx123.public.blob.vercel-storage.com/cosmic-archive/episode-slug-name.jpg
```

Characteristics:
- Static images, no on-the-fly transformation
- Highly available CDN delivery
- No query parameter transforms available

### Cosmic imgix URLs (Hot Storage)

Format: `https://imgix.cosmicjs.com/{bucket}/{filename}`

Example:
```
https://imgix.cosmicjs.com/abc123-bucket/show-artwork.jpg?w=800&h=800&fit=crop
```

Characteristics:
- Supports imgix transformation parameters
- Can resize, crop, format on-the-fly
- More expensive storage

---

## Object Type Reference

### Episode

```swift
struct EpisodeMetadata: Codable {
    let image: CosmicImage?
    let externalImageURL: String?  // NEW FIELD
    let broadcastDate: String?
    let broadcastTime: String?
    let duration: String?
    let description: String?
    let player: String?
    let tracklist: String?
    let genres: [Genre]?
    let regularHosts: [Host]?
    let takeovers: [Takeover]?
    // ... other fields
    
    enum CodingKeys: String, CodingKey {
        case image
        case externalImageURL = "external_image_url"
        case broadcastDate = "broadcast_date"
        case broadcastTime = "broadcast_time"
        case duration
        case description
        case player
        case tracklist
        case genres
        case regularHosts = "regular_hosts"
        case takeovers
    }
}
```

### Host (regular-hosts)

```swift
struct HostMetadata: Codable {
    let image: CosmicImage?
    let externalImageURL: String?  // NEW FIELD
    let description: String?
    
    enum CodingKeys: String, CodingKey {
        case image
        case externalImageURL = "external_image_url"
        case description
    }
}
```

### Takeover

```swift
struct TakeoverMetadata: Codable {
    let image: CosmicImage?
    let externalImageURL: String?  // NEW FIELD
    let description: String?
    
    enum CodingKeys: String, CodingKey {
        case image
        case externalImageURL = "external_image_url"
        case description
    }
}
```

### Post

```swift
struct PostMetadata: Codable {
    let image: CosmicImage?
    let externalImageURL: String?  // NEW FIELD
    let type: PostTypeEnum?
    let categories: [Category]?
    let author: Author?
    let date: String?
    let excerpt: String?
    let content: String?
    let isFeatured: Bool?
    // ... other fields
    
    enum CodingKeys: String, CodingKey {
        case image
        case externalImageURL = "external_image_url"
        case type
        case categories
        case author
        case date
        case excerpt
        case content
        case isFeatured = "is_featured"
    }
}
```

### Video

```swift
struct VideoMetadata: Codable {
    let image: CosmicImage?
    let externalImageURL: String?  // NEW FIELD
    let description: String?
    let videoURL: String?
    let categories: [Category]?
    let featuredOnHomepage: Bool?
    
    enum CodingKeys: String, CodingKey {
        case image
        case externalImageURL = "external_image_url"
        case description
        case videoURL = "video_url"
        case categories
        case featuredOnHomepage = "featured_on_homepage"
    }
}
```

---

## Image Helper Protocol

For a clean, reusable implementation across all object types:

```swift
protocol ImageResolvable {
    var cosmicImage: CosmicImage? { get }
    var externalImageURL: String? { get }
}

extension ImageResolvable {
    var resolvedImageURL: URL? {
        if let external = externalImageURL, let url = URL(string: external) {
            return url
        }
        if let imgix = cosmicImage?.imgixURL, let url = URL(string: imgix) {
            return url
        }
        if let raw = cosmicImage?.url, let url = URL(string: raw) {
            return url
        }
        return nil
    }
    
    var hasImage: Bool {
        resolvedImageURL != nil
    }
}

// Example conformance
extension EpisodeMetadata: ImageResolvable {
    var cosmicImage: CosmicImage? { image }
}

extension HostMetadata: ImageResolvable {
    var cosmicImage: CosmicImage? { image }
}
```

---

## Migration Notes

### What Changed

1. **~4,000+ older episodes** now have images on Vercel Blob instead of Cosmic
2. **Cosmic `image` field preserved** — The original Cosmic image object remains but may point to deleted/moved media
3. **`external_image_url` added** — New field contains the Vercel Blob URL when applicable
4. **Hot storage threshold**: Items beyond position ~1,000 (sorted by date) are migrated

### Backwards Compatibility

- Objects without `external_image_url` continue to work using `image.imgix_url` or `image.url`
- New episodes added to Cosmic will NOT have `external_image_url` (they remain in hot storage)
- The fallback chain ensures the app works with both old and new data

---

## URL Detection Helpers

```swift
enum ImageStorageType {
    case vercelBlob
    case cosmicImgix
    case cosmicCDN
    case unknown
}

func detectStorageType(url: String) -> ImageStorageType {
    if url.contains(".public.blob.vercel-storage.com") || 
       url.contains(".blob.vercel-storage.com") {
        return .vercelBlob
    }
    if url.contains("imgix.cosmicjs.com") || 
       url.contains("cosmic-s3.imgix.net") {
        return .cosmicImgix
    }
    if url.contains("cdn.cosmicjs.com") {
        return .cosmicCDN
    }
    return .unknown
}
```

---

## Image Transformation Notes

### Vercel Blob (Cold Storage)
- **No transformation support** — Images are served as-is
- Pre-optimized during migration (~350KB average)
- Consider client-side caching strategies

### Cosmic imgix (Hot Storage)
- Full imgix transformation support
- Recommended parameters:
  - `?w=400&h=400&fit=crop` — Square thumbnail
  - `?w=800&auto=format` — Responsive image
  - `?fm=webp&q=80` — WebP with quality

```swift
extension URL {
    /// Adds imgix parameters only if the URL is from Cosmic imgix
    func withImgixParams(width: Int? = nil, height: Int? = nil) -> URL {
        guard absoluteString.contains("imgix.cosmicjs.com") else {
            return self // Don't modify Vercel Blob URLs
        }
        
        var components = URLComponents(url: self, resolvingAgainstBaseURL: false)
        var queryItems = components?.queryItems ?? []
        
        if let w = width {
            queryItems.append(URLQueryItem(name: "w", value: String(w)))
        }
        if let h = height {
            queryItems.append(URLQueryItem(name: "h", value: String(h)))
        }
        queryItems.append(URLQueryItem(name: "auto", value: "format"))
        
        components?.queryItems = queryItems
        return components?.url ?? self
    }
}
```

---

## Testing Checklist

- [ ] Episodes with `external_image_url` display correctly
- [ ] Episodes without `external_image_url` fall back to Cosmic image
- [ ] Hosts/Takeovers/Posts with blob images display correctly  
- [ ] Image placeholder shows when no image available
- [ ] No crashes when `external_image_url` is null/missing
- [ ] imgix transforms still work for hot storage images
- [ ] Vercel Blob URLs load without transformation attempts

---

## API Query Considerations

When fetching objects from Cosmic, ensure `external_image_url` is included in the props:

```swift
// Example: Fetching episodes with the new field
let query = cosmic.objects.find(type: "episode")
    .props("id,slug,title,metadata.image,metadata.external_image_url,metadata.broadcast_date")
    .sort("-metadata.broadcast_date")
    .limit(50)
```

---

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| Image Source | Always Cosmic | Cosmic OR Vercel Blob |
| New Field | N/A | `external_image_url` |
| Resolution Logic | `image.imgix_url` → `image.url` | `external_image_url` → `image.imgix_url` → `image.url` |
| Transforms | Always available | Only for Cosmic imgix URLs |
| Storage Split | All on Cosmic | ~1000 hot (Cosmic) + cold (Blob) |

