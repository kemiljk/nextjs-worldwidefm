'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';
import { useMediaPlayer } from '@/components/providers/media-player-provider';
import { usePlausible } from 'next-plausible';
import Link from 'next/link';

declare global {
  interface Window {
    io?: (
      url: string,
      options?: {
        auth?: Record<string, string>;
        transports?: string[];
        query?: Record<string, string>;
      }
    ) => {
      on: (event: string, callback: (data?: unknown) => void) => void;
      disconnect: () => void;
      readyState: number;
    };
  }
}

interface StreamState {
  loading: boolean;
  error: string | null;
  connected: boolean;
}

interface LiveMetadata {
  content?: {
    title?: string;
    artist?: string;
    image?: string;
  };
  metadata?: {
    bitrate?: number;
    listeners?: number;
  };
}

export default function LivePlayer() {
  const { isLivePlaying, playLive, pauseLive, liveVolume } = useMediaPlayer();
  const plausible = usePlausible();

  const [streamState, setStreamState] = useState<StreamState>({
    loading: false,
    error: null,
    connected: false,
  });

  const [liveMetadata, setLiveMetadata] = useState<LiveMetadata>({});

  // Simple: if we receive metadata from WebSocket, we have a show. Otherwise, nothing.

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const socketRef = useRef<ReturnType<NonNullable<typeof window.io>> | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Environment variables
  const streamUrl = process.env.NEXT_PUBLIC_RADIOCULT_STREAM_URL;
  const stationId = process.env.NEXT_PUBLIC_RADIOCULT_STATION_ID;
  const apiKey = process.env.NEXT_PUBLIC_RADIOCULT_PUBLISHABLE_KEY;

  // Fetch current show immediately on mount for instant display
  // WebSocket will then update it in real-time
  useEffect(() => {
    const fetchCurrentShow = async () => {
      try {
        const response = await fetch('/api/live/current', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        const data = await response.json();

        if (data.success && data.currentEvent) {
          // Set initial show immediately - WebSocket will update it later
          setLiveMetadata({
            content: {
              title: data.currentEvent.showName,
              artist: data.currentEvent.artists?.[0]?.name,
              image: data.currentEvent.imageUrl,
            },
          });
        }
      } catch (error) {
        // Silently fail - WebSocket will provide data
      }
    };

    fetchCurrentShow();
  }, []);
  // Schedule API is unreliable for real-time detection, WebSocket provides instant updates

  // Initialize audio element when we have metadata from WebSocket
  useEffect(() => {
    // Only initialize audio if we have metadata (show is playing)
    if (!liveMetadata.content?.title) {
      // Clean up audio if no show
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      return;
    }

    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'none';
      audio.volume = liveVolume;
      // Note: crossOrigin removed - not needed for audio streams and causes CORS issues
      audioRef.current = audio;

      // Set up audio event listeners
      audio.addEventListener('loadstart', () => {
        setStreamState(prev => ({ ...prev, loading: true, error: null }));
      });

      audio.addEventListener('canplay', () => {
        setStreamState(prev => ({ ...prev, loading: false, connected: true }));
      });

      audio.addEventListener('error', () => {
        const error = audio.error;
        let errorMessage = 'Stream connection failed';

        if (error) {
          switch (error.code) {
            case error.MEDIA_ERR_NETWORK:
              errorMessage = 'Network error';
              break;
            case error.MEDIA_ERR_DECODE:
              errorMessage = 'Stream decode error';
              break;
            case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
              errorMessage = 'Stream format not supported';
              break;
            default:
              errorMessage = 'Unknown stream error';
          }
        }

        console.error('Audio error:', error);
        setStreamState(prev => ({
          ...prev,
          loading: false,
          error: errorMessage,
          connected: false,
        }));
      });

      audio.addEventListener('ended', () => {
        setStreamState(prev => ({ ...prev, connected: false }));
        pauseLive();
      });

      audio.addEventListener('pause', () => {
        setStreamState(prev => ({ ...prev, loading: false }));
      });

      audio.addEventListener('playing', () => {
        setStreamState(prev => ({ ...prev, loading: false, connected: true, error: null }));
      });
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, [liveMetadata.content?.title, liveVolume, pauseLive]);

  // WebSocket connection for real-time metadata
  const connectWebSocket = useCallback(() => {
    if (!stationId || !apiKey) {
      console.warn('RadioCult WebSocket: Missing station ID or API key');
      return;
    }

    // Don't connect if already connected
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      // Using Socket.IO as mentioned in RadioCult API docs
      if (typeof window !== 'undefined' && window.io) {
        const socket = window.io('https://api.radiocult.fm', {
          auth: {
            'x-api-key': apiKey,
          },
          transports: ['websocket'],
          query: {
            stationId: stationId,
          },
        });

        socket.on('connect', () => {
          setStreamState(prev => ({ ...prev, error: null }));
          // Metadata will arrive immediately after connect, updating to current show
        });

        socket.on('player-metadata', (data?: unknown) => {
          const metadata = data as
            | {
                status?: string;
                content?: { title?: string; artist?: string; image?: string; name?: string };
                metadata?: {
                  bitrate?: number;
                  listeners?: number;
                  title?: string;
                  artist?: string;
                };
              }
            | undefined;

          if (metadata) {
            // Extract content - prioritize show/playlist name (scheduled show) over current track
            // content.name = scheduled show name (e.g., "WWFM Playlist")
            // metadata.title = current track playing (e.g., "Leave The Hall")
            const contentTitle =
              metadata.content?.name || metadata.content?.title || metadata.metadata?.title;
            const contentArtist = metadata.content?.artist || metadata.metadata?.artist;

            // Always update immediately with latest metadata - this is the current live show
            setLiveMetadata({
              content: {
                title: contentTitle,
                artist: contentArtist,
                image: metadata.content?.image,
              },
              metadata: metadata.metadata,
            });
          }
        });

        socket.on('disconnect', () => {
          // Attempt reconnection immediately - don't clear metadata yet
          // Keep showing last known show until we reconnect and get new data
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 1000);
        });

        socket.on('error', (error?: unknown) => {
          console.error('RadioCult WebSocket error:', error);
        });

        socketRef.current = socket;
      }
    } catch (error) {
      console.error('WebSocket connection error:', error);
    }
  }, [stationId, apiKey]);

  // Initialize WebSocket connection immediately on mount
  useEffect(() => {
    if (!stationId || !apiKey) {
      return;
    }

    // Connect immediately - Socket.IO should be preloaded in layout
    // If not available, load it quickly
    if (typeof window !== 'undefined') {
      if (window.io) {
        // Socket.IO already loaded, connect immediately
        connectWebSocket();
      } else {
        // Load Socket.IO with async to not block, but connect as soon as ready
        const script = document.createElement('script');
        script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
        script.async = true;
        script.onload = () => {
          connectWebSocket();
        };
        script.onerror = () => {
          console.error('[LivePlayer] Failed to load Socket.IO');
        };
        document.head.appendChild(script);
      }
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectWebSocket, stationId, apiKey]);

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = liveVolume;
    }
  }, [liveVolume]);

  // Handle play/pause state changes
  useEffect(() => {
    if (!audioRef.current) return;

    if (isLivePlaying && liveMetadata.content?.title) {
      if (!streamUrl) {
        setStreamState(prev => ({
          ...prev,
          error: 'Stream URL not configured',
        }));
        pauseLive();
        return;
      }

      if (audioRef.current.src !== streamUrl) {
        audioRef.current.src = streamUrl;
      }

      setStreamState(prev => ({ ...prev, loading: true, error: null }));

      audioRef.current.play().catch(error => {
        console.error('Error playing live stream:', error);
        setStreamState(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to start playback',
          connected: false,
        }));
        pauseLive();
      });
    } else {
      audioRef.current.pause();
      setStreamState(prev => ({ ...prev, loading: false, connected: false }));
    }
  }, [isLivePlaying, liveMetadata.content?.title, streamUrl, pauseLive]);

  const handlePlayPause = () => {
    // If we have metadata, we can play
    if (!hasShow) return;

    // Create event from WebSocket metadata
    const eventToPlay = {
      showName: liveMetadata.content?.title || 'Live Show',
      ...liveMetadata.content,
    };

    if (streamState.error) {
      // Retry on error
      setStreamState(prev => ({ ...prev, error: null }));
      if (audioRef.current && streamUrl) {
        audioRef.current.src = streamUrl;
      }
    }

    if (isLivePlaying) {
      plausible('Live Stream Paused', {
        props: {
          show: eventToPlay.showName || 'Unknown',
        },
      });
      pauseLive();
    } else {
      plausible('Live Stream Played', {
        props: {
          show: eventToPlay.showName || 'Unknown',
        },
      });
      playLive(eventToPlay);
    }
  };

  // Simple: if we have metadata content, we have a show
  const hasShow = Boolean(liveMetadata.content?.title);

  // Check if this is a playlist (not a scheduled show)
  const currentTitle = liveMetadata.content?.title || '';
  const isPlaylist = currentTitle.toLowerCase().includes('playlist') || 
                     currentTitle.toLowerCase().includes('wwfm') && !currentTitle.toLowerCase().includes('show');
  
  // Display "Check out our schedule" for playlists, otherwise show the show name
  const displayName = !hasShow 
    ? 'Nothing currently live' 
    : isPlaylist 
      ? 'Check out our schedule' 
      : currentTitle;

  // Link destination - schedule for playlists, otherwise stay on current page
  const linkHref = isPlaylist ? '/schedule' : hasShow ? '/schedule' : undefined;

  return (
    <div className='fixed top-0 bg-almostblack text-white dark:bg-black dark:text-white z-50 flex items-center transition-all duration-300 h-11 left-0 right-0 max-w-full'>
      <div className='ml-4 flex items-center shrink-0 transition-opacity duration-200'>
        <button
          className='rounded-full transition-colors disabled:opacity-100 text-white'
          disabled={!hasShow}
          onClick={handlePlayPause}
        >
          {isLivePlaying && streamState.loading ? (
            <Loader2 className='h-3 w-3 animate-spin' />
          ) : isLivePlaying ? (
            <Pause fill='white' className='size-5' />
          ) : (
            <Play fill='white' className='size-5' />
          )}
        </button>
      </div>
      <div className='flex items-center mx-2 gap-2 overflow-hidden flex-1'>
        {linkHref ? (
          <Link 
            href={linkHref} 
            className='text-m7 font-mono uppercase whitespace-nowrap hover:underline transition-all'
          >
            {displayName}
          </Link>
        ) : (
          <div className='text-m7 font-mono uppercase whitespace-nowrap'>{displayName}</div>
        )}
      </div>
    </div>
  );
}
