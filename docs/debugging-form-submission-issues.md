# Debugging Form Submission Issues

## Problem
Users experience intermittent form submission failures where the form shows "Submitting..." then returns to "Submit" without creating a draft in the backend. No error messages are displayed to the user.

## Root Causes Identified

1. **Timeout Issues**: Large file uploads (up to 600MB for media) could timeout with default Vercel settings (10s for hobby plans)
2. **Silent Network Failures**: Errors from API routes weren't being properly caught and displayed
3. **Sequential Upload Chain**: Form uploads image → media → creates show. Any failure in the chain could cause silent failures
4. **Insufficient Error Logging**: Limited visibility into where the failure occurred

## Changes Made (2024-10-14)

### 1. Enhanced Client-Side Error Handling (`app/add-show/add-show-form.tsx`)

**Before**: Basic error handling with minimal logging
**After**: 
- Comprehensive logging at every step of the submission process
- Individual try-catch blocks for each upload step (image, media, show creation)
- Better error parsing for non-JSON responses
- Detailed error messages displayed to users with 10s duration
- Full error stack traces logged to console

**Key improvements:**
```typescript
// Now logs file sizes, step-by-step progress, and detailed errors
console.log('🚀 Starting form submission:', { title, hasImageFile, hasMediaFile, sizes });
console.log('📸 Starting image upload...');
console.log('🎵 Starting media upload...');
console.log('📝 Creating show in Cosmic...');
```

### 2. Added Timeout Configuration to API Routes

**All affected routes now have `maxDuration` exports:**
- `/api/upload-image`: 60 seconds (was 10s default)
- `/api/upload-media`: 300 seconds (5 minutes for large files, was 10s default)
- `/api/shows/create`: 60 seconds (was 10s default)

This prevents Vercel from timing out during large file uploads.

### 3. Enhanced Server-Side Logging

**All API routes now log:**
- Request received with file details (name, size, type)
- Each processing step (parsing, uploading to Cosmic/RadioCult)
- Success/failure status with timestamps
- Full error details including stack traces

### 4. Better Error Responses

API routes now return detailed error messages:
```json
{
  "error": "Failed to upload media",
  "details": "Specific error message here"
}
```

## How to Debug Future Issues

### For Users Experiencing the Issue

When the form shows "Submitting..." then returns to "Submit" without success:

1. **Open Browser DevTools** (F12 or Right-click → Inspect)
2. **Go to Console tab** - Look for log messages with emojis:
   - 🚀 Starting form submission
   - 📸 Image upload steps
   - 🎵 Media upload steps
   - 📝 Show creation steps
   - ❌ Error indicators

3. **Go to Network tab** - Check for:
   - Failed requests (red status codes)
   - Requests that take too long (pending forever)
   - Look at response content for error messages

4. **Take screenshots** of:
   - Console errors
   - Network tab showing failed requests
   - Any error toast notifications

### For Developers

#### Check Vercel Logs
```bash
# View real-time logs
vercel logs --follow

# View logs for a specific function
vercel logs /api/upload-media --follow
```

#### Monitor Server Logs

All API routes now log with these prefixes:
- 📸 Image upload operations
- 🎵 Media upload operations
- 📝 Show creation operations
- ✅ Success indicators
- ❌ Error indicators
- ⚠️ Warning indicators
- ℹ️ Info messages

Search logs for these emojis to quickly identify where failures occur.

#### Common Issues to Check

1. **Vercel Function Timeout**
   - Check if request is hitting the `maxDuration` limit
   - Increase if needed in route file: `export const maxDuration = 300;`

2. **Cosmic API Issues**
   - Check Cosmic dashboard for API status
   - Verify write key has correct permissions
   - Check bucket storage limits

3. **RadioCult API Issues**
   - Check if RadioCult API is returning errors
   - Verify API key is valid
   - Check rate limits

4. **File Size Issues**
   - Verify files are within limits (10MB for images, 600MB for media)
   - Check if buffer conversion is failing for large files

5. **Network Issues**
   - User's connection might be unstable
   - Check if request is being cancelled mid-upload
   - Consider implementing retry logic

## Testing the Fix

To verify the improvements work:

1. **Test with Console Open**
   - Submit a show with console open
   - Verify you see all the log messages
   - Confirm errors (if any) are clearly displayed

2. **Test Large Files**
   - Upload a large media file (>100MB)
   - Verify it doesn't timeout
   - Check logs show progress

3. **Test Network Failures**
   - Throttle network in DevTools
   - Submit form
   - Verify error messages are clear

4. **Test Error Scenarios**
   - Invalid file types
   - Missing required fields
   - Verify user-friendly error messages

## Next Steps if Issues Persist

If users still experience silent failures after these changes:

1. **Add Client-Side Monitoring**
   - Consider integrating Sentry or similar for error tracking
   - Track form submission events and failures

2. **Add Progress Indicators**
   - Show upload progress percentages
   - Display which step is currently processing

3. **Implement Retry Logic**
   - Auto-retry failed requests
   - Save form state to localStorage for recovery

4. **Add Upload Resumption**
   - Use tus.io or similar for resumable uploads
   - Allow users to continue interrupted uploads

5. **Split Large Uploads**
   - Consider chunked uploads for files >100MB
   - Implement multipart upload strategy

## Environment Variables to Verify

Ensure these are set correctly in Vercel:
- `NEXT_PUBLIC_COSMIC_BUCKET_SLUG`
- `NEXT_PUBLIC_COSMIC_READ_KEY`
- `COSMIC_WRITE_KEY`
- `NEXT_PUBLIC_RADIOCULT_STATION_ID`
- `RADIOCULT_SECRET_KEY`

## Support Information

If a user reports this issue:

1. Ask them to open console and retry
2. Ask for screenshots of console errors
3. Check Vercel logs for their submission timestamp
4. Look for the specific error emoji (❌) in logs
5. Cross-reference with Cosmic and RadioCult API status

