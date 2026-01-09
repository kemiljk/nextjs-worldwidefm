'use client';

interface TracklistProps {
  content: string;
  className?: string;
}

interface Track {
  artist: string;
  title: string;
}

export function Tracklist({ content, className = '' }: TracklistProps) {
  if (!content) return null;

  // Parse the tracklist content to extract artist and title information
  const parseTracklist = (htmlContent: string): Track[] => {
    const tracks: Track[] = [];

    // Normalize HTML: replace <br> tags with newlines, handle <p> tags
    // This handles both simple <br /> formats and Rich Text editor formats with <p> tags
    let normalizedContent = htmlContent
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/div>/gi, '\n')
      .replace(/<div[^>]*>/gi, '');

    // Create a temporary DOM element to extract text content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = normalizedContent;
    const textContent = tempDiv.textContent || '';
    const lines = textContent.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Try to parse different formats
      let artist = '';
      let title = '';

      // Format: "Artist - Title"
      if (trimmedLine.includes(' - ')) {
        const parts = trimmedLine.split(' - ');
        if (parts.length >= 2) {
          artist = parts[0].trim();
          title = parts.slice(1).join(' - ').trim();
        }
      }
      // Format: "Artist: Title"
      else if (trimmedLine.includes(': ')) {
        const parts = trimmedLine.split(': ');
        if (parts.length >= 2) {
          artist = parts[0].trim();
          title = parts.slice(1).join(': ').trim();
        }
      }
      // Format: "Artist – Title" (en dash)
      else if (trimmedLine.includes(' – ')) {
        const parts = trimmedLine.split(' – ');
        if (parts.length >= 2) {
          artist = parts[0].trim();
          title = parts.slice(1).join(' - ').trim();
        }
      }
      // Format: "Artist / Title"
      else if (trimmedLine.includes(' / ')) {
        const parts = trimmedLine.split(' / ');
        if (parts.length >= 2) {
          artist = parts[0].trim();
          title = parts.slice(1).join(' / ').trim();
        }
      }
      // Format: "Artist | Title"
      else if (trimmedLine.includes(' | ')) {
        const parts = trimmedLine.split(' | ');
        if (parts.length >= 2) {
          artist = parts[0].trim();
          title = parts.slice(1).join(' | ').trim();
        }
      }
      // If no separator found, treat whole line as title
      else {
        title = trimmedLine;
      }

      if (artist || title) {
        tracks.push({ artist, title });
      }
    }

    return tracks;
  };

  // Parse tracks directly
  const tracks = parseTracklist(content);

  if (tracks.length === 0) {
    // Fallback to original content if parsing fails
    return (
      <div className={`prose dark:prose-invert max-w-none ${className}`}>
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    );
  }

  return (
    <div className={`space-y-0 pl-1 ${className}`}>
      {tracks.map((track, index) => (
        <div
          key={index}
          className='py-4 border-b border-0.5 border-almostblack dark:border-white w-full flex flex-row gap-10'
        >
          <div className='w-[30%] font-mono text-m8 uppercase text-almostblack dark:text-white'>
            {track.artist || 'Unknown Artist'}
          </div>
          <div className='w-[70%] font-mono text-m8 uppercase text-almostblack dark:text-white'>
            {track.title}
          </div>
        </div>
      ))}
    </div>
  );
}

// Server-side version for static generation
export function TracklistServer({ content, className = '' }: TracklistProps) {
  if (!content) return null;

  // Simple parsing for server-side rendering
  const parseTracklistServer = (htmlContent: string): Track[] => {
    // Normalize HTML: replace <br> tags with newlines, handle <p> tags
    // This handles both simple <br /> formats and Rich Text editor formats with <p> tags
    let normalizedContent = htmlContent
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/div>/gi, '\n')
      .replace(/<div[^>]*>/gi, '');

    // Remove remaining HTML tags and split by lines
    const cleanContent = normalizedContent.replace(/<[^>]*>/g, '');
    const lines = cleanContent.split('\n');

    const tracks: Track[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      let artist = '';
      let title = '';

      // Format: "Artist - Title"
      if (trimmedLine.includes(' - ')) {
        const parts = trimmedLine.split(' - ');
        if (parts.length >= 2) {
          artist = parts[0].trim();
          title = parts.slice(1).join(' - ').trim();
        }
      }
      // Format: "Artist: Title"
      else if (trimmedLine.includes(': ')) {
        const parts = trimmedLine.split(': ');
        if (parts.length >= 2) {
          artist = parts[0].trim();
          title = parts.slice(1).join(': ').trim();
        }
      }
      // Format: "Artist – Title" (en dash)
      else if (trimmedLine.includes(' – ')) {
        const parts = trimmedLine.split(' – ');
        if (parts.length >= 2) {
          artist = parts[0].trim();
          title = parts.slice(1).join(' – ').trim();
        }
      }
      // Format: "Artist / Title"
      else if (trimmedLine.includes(' / ')) {
        const parts = trimmedLine.split(' / ');
        if (parts.length >= 2) {
          artist = parts[0].trim();
          title = parts.slice(1).join(' / ').trim();
        }
      }
      // Format: "Artist | Title"
      else if (trimmedLine.includes(' | ')) {
        const parts = trimmedLine.split(' | ');
        if (parts.length >= 2) {
          artist = parts[0].trim();
          title = parts.slice(1).join(' | ').trim();
        }
      }
      // If no separator found, treat whole line as title
      else {
        title = trimmedLine;
      }

      if (artist || title) {
        tracks.push({ artist, title });
      }
    }

    return tracks;
  };

  const tracks = parseTracklistServer(content);

  if (tracks.length === 0) {
    // Fallback to original content if parsing fails
    return (
      <div className={`prose dark:prose-invert max-w-none ${className}`}>
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    );
  }

  return (
    <div className={`space-y-0 ${className}`}>
      {tracks.map((track, index) => (
        <div
          key={index}
          className='py-4 border-b border-0.5 border-almostblack dark:border-white w-full flex flex-row gap-10'
        >
          <div className='w-[30%] font-mono text-m8 uppercase text-almostblack dark:text-white'>
            {track.artist || 'Unknown Artist'}
          </div>
          <div className='w-[70%] font-mono text-m8 uppercase text-almostblack dark:text-white'>
            {track.title}
          </div>
        </div>
      ))}
    </div>
  );
}
