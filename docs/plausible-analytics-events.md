# Plausible Analytics - Custom Events

This document outlines all custom events implemented across the Worldwide FM website using Plausible Analytics via the `next-plausible` package.

## Setup

Plausible is integrated at the root level in `app/layout.tsx` using `PlausibleProvider`. All components use the `usePlausible()` hook to track custom events.

## Custom Events

### 1. Live Stream Events

**Location:** `components/live-player.tsx`

#### `Live Stream Played`
- **Trigger:** User clicks play on the live stream
- **Props:**
  - `show`: The name of the live show being played

#### `Live Stream Paused`
- **Trigger:** User pauses the live stream
- **Props:**
  - `show`: The name of the live show being paused

---

### 2. Archive Player Events

**Location:** `components/archive-player.tsx`

#### `Archive Show Played`
- **Trigger:** User opens/plays an archived show
- **Props:**
  - `show`: The name/title of the show
  - `slug`: The show's URL slug

#### `Archive Player Closed`
- **Trigger:** User closes the archive player
- **Props:**
  - `show`: The name/title of the show
  - `slug`: The show's URL slug

---

### 3. Episode Playback Events

**Location:** `components/play-button.tsx`

#### `Episode Play Button Clicked`
- **Trigger:** User clicks play on a new episode (not currently playing)
- **Props:**
  - `show`: The name/title of the episode
  - `slug`: The episode's URL slug

#### `Episode Paused`
- **Trigger:** User pauses a currently playing episode
- **Props:**
  - `show`: The name/title of the episode
  - `slug`: The episode's URL slug

#### `Episode Resumed`
- **Trigger:** User resumes a paused episode
- **Props:**
  - `show`: The name/title of the episode
  - `slug`: The episode's URL slug

---

### 4. External Link Events

**Location:** `components/discord-button.tsx`

#### `Discord Link Clicked`
- **Trigger:** User clicks the Discord button
- **Props:**
  - `source`: Always "fixed_button" (to identify the button location)

---

### 5. Contact Form Events

**Location:** `app/contact/contact-form.tsx`

#### `Contact Form Submitted`
- **Trigger:** User successfully submits the contact form
- **Props:**
  - `subject`: The subject line of the message

#### `Contact Form Error`
- **Trigger:** Contact form submission fails
- **Props:**
  - `error`: Error message description

---

### 6. Show Submission Events

**Location:** `app/add-show/add-show-form.tsx`

#### `Show Submitted`
- **Trigger:** User successfully submits a new show for approval
- **Props:**
  - `title`: The show title
  - `hasMedia`: Boolean indicating if audio file was uploaded
  - `hasImage`: Boolean indicating if image was uploaded
  - `genreCount`: Number of genres selected

#### `Show Submission Error`
- **Trigger:** Show submission fails at any stage
- **Props:**
  - `error`: Error message description
  - `phase`: Which phase of submission failed (preparing, uploadingImage, uploadingMedia, creatingShow)

---

### 7. Show Filter Events

**Location:** `components/shows-filter.tsx`

#### `Shows Filter Applied`
- **Trigger:** User applies a filter (genre, host, or takeover)
- **Props:**
  - `filterType`: Type of filter (genre/host/takeover)
  - `filterValue`: The selected filter value

#### `Shows Search Used`
- **Trigger:** User enters a search term (debounced, fires after 1 second of no typing)
- **Props:**
  - `searchLength`: Length of the search query

#### `New Shows Filter Toggled`
- **Trigger:** User enables the "New Shows" filter
- **Props:**
  - `enabled`: Always "true" (only tracks when enabled)

---

### 8. Genre Selection Events

**Location:** `components/genre-selector.tsx`

#### `Genre Selected`
- **Trigger:** User selects a genre from the genre selector
- **Props:**
  - `genre`: The genre name
  - `source`: Always "genre_selector" (to identify the source)

---

### 9. Search Events

**Location:** `components/search.tsx`

#### `Search Query Entered`
- **Trigger:** User enters a search query (minimum 3 characters, debounced for 1 second)
- **Props:**
  - `searchLength`: Length of the search query

---

### 10. Membership Events

**Locations:** 
- `components/membership-promo-section.tsx`
- `cosmic/blocks/user-management/MembershipSignupClient.tsx`

#### `Membership CTA Clicked`
- **Trigger:** User clicks "Learn More" button in membership promo section
- **Props:**
  - `source`: Always "promo_section"

#### `Membership Signup Initiated`
- **Trigger:** User clicks "JOIN NOW" button on membership page (after filling form)
- **Props:**
  - `isLoggedIn`: Boolean indicating if user is logged in

#### `Membership Checkout Started`
- **Trigger:** User is successfully redirected to Stripe checkout
- **Props:**
  - `isLoggedIn`: Boolean indicating if user is logged in

#### `Membership Signup Error`
- **Trigger:** Error occurs during membership signup process
- **Props:**
  - `error`: Error message description
  - `stage`: Which stage failed (checkout_session/network)

---

## Event Naming Convention

All custom events follow a consistent naming pattern:
- Use Title Case for event names
- Use descriptive, action-oriented names (e.g., "Clicked", "Submitted", "Selected")
- Props use camelCase

## Analytics Dashboard

You can view these custom events in your Plausible dashboard at:
`https://plausible.io/worldwidefm.net`

Navigate to the "Goals" section to see custom event breakdowns with their properties.

## Future Enhancements

Consider adding events for:
- Video player interactions
- Newsletter signups
- Social media link clicks
- Schedule interactions
- Editorial content engagement
- Membership conversion completion (via Stripe webhook)

