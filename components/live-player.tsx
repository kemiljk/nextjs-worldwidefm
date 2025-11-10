'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';
import { useMediaPlayer } from '@/components/providers/media-player-provider';
import { usePlausible } from 'next-plausible';

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
  const { currentLiveEvent, isLivePlaying, playLive, pauseLive, liveVolume } = useMediaPlayer();
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
  const metadataTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Environment variables
  const streamUrl = process.env.NEXT_PUBLIC_RADIOCULT_STREAM_URL;
  const stationId = process.env.NEXT_PUBLIC_RADIOCULT_STATION_ID;
  const apiKey = process.env.NEXT_PUBLIC_RADIOCULT_PUBLISHABLE_KEY;

  // Debug logging (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[LivePlayer] Stream URL:', streamUrl);
      console.debug('[LivePlayer] Station ID:', stationId);
    }
  }, [streamUrl, stationId]);

  // Schedule check removed - WebSocket is the only source of truth for live status
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
          console.log('RadioCult WebSocket connected');
          setStreamState(prev => ({ ...prev, error: null }));
        });

        socket.on('player-metadata', (data?: unknown) => {
          console.log('[LivePlayer] Raw WebSocket data received:', data);
          const metadata = data as
            | {
                status?: string;
                content?: { title?: string; artist?: string; image?: string; name?: string };
                metadata?: { bitrate?: number; listeners?: number; title?: string; artist?: string };
              }
            | undefined;
          
          if (metadata) {
            console.log('[LivePlayer] Parsed metadata:', metadata);
            
            // Extract content - prioritize show/playlist name (scheduled show) over current track
            // content.name = scheduled show name (e.g., "WWFM Playlist")
            // metadata.title = current track playing (e.g., "Leave The Hall")
            const contentTitle = metadata.content?.name || 
                                metadata.content?.title || 
                                metadata.metadata?.title;
            const contentArtist = metadata.content?.artist || 
                                 metadata.metadata?.artist;
            
            console.log('[LivePlayer] Extracted title:', contentTitle, 'artist:', contentArtist);
            
            // If we receive metadata, we have a show - update it
            setLiveMetadata({
              content: {
                title: contentTitle,
                artist: contentArtist,
                image: metadata.content?.image,
              },
              metadata: metadata.metadata,
            });

            // Reset metadata timeout - if no updates for 2 minutes, clear metadata
            if (metadataTimeoutRef.current) {
              clearTimeout(metadataTimeoutRef.current);
            }
            metadataTimeoutRef.current = setTimeout(() => {
              console.log('[LivePlayer] No metadata updates for 2 minutes, clearing');
              setLiveMetadata({});
            }, 120000);
          } else {
            console.log('[LivePlayer] No metadata in received data');
          }
        });

        socket.on('disconnect', () => {
          console.log('RadioCult WebSocket disconnected');
          // Attempt reconnection after 5 seconds
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
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

  // Initialize WebSocket connection only when needed
  useEffect(() => {
    // Only connect WebSocket if we have environment variables configured
    // and either have a live event or need to detect one
    if (!stationId || !apiKey) {
      return;
    }

    // Load Socket.IO if not already loaded
    if (typeof window !== 'undefined' && !window.io) {
      const script = document.createElement('script');
      script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
      script.onload = () => {
        connectWebSocket();
      };
      document.head.appendChild(script);
    } else {
      connectWebSocket();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (metadataTimeoutRef.current) {
        clearTimeout(metadataTimeoutRef.current);
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

  // Display current track/playlist name, or "Nothing currently live"
  const displayName = liveMetadata.content?.title || 'Nothing currently live';

  // Debug logging
  useEffect(() => {
    console.log('[LivePlayer] Current state:', {
      hasShow,
      displayName,
      liveMetadata,
    });
  }, [hasShow, displayName, liveMetadata]);

  return (
    <div className='fixed top-0 bg-almostblack text-white dark:bg-black dark:text-white z-50 flex items-center transition-all duration-300 h-7 left-0 right-0 max-w-full'>
      <div className='ml-4 flex items-center shrink-0 transition-opacity duration-200'>
        <button
          className='rounded-full transition-colors disabled:opacity-100 text-white'
          disabled={!hasShow}
          onClick={handlePlayPause}
        >
          {isLivePlaying && streamState.loading ? (
            <Loader2 className='h-3 w-3 animate-spin' />
          ) : isLivePlaying ? (
            <Pause fill='white' className='h-3 w-3' />
          ) : (
            <Play fill='white' className='h-3 w-3' />
          )}
        </button>
      </div>
      <div className='flex items-center mx-2 gap-2 overflow-hidden'>
        <div className='text-m8 font-mono uppercase whitespace-nowrap'>{displayName}</div>
      </div>
    </div>
  );
}
