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
  status: 'live' | 'offline';
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

  const [liveMetadata, setLiveMetadata] = useState<LiveMetadata>({ status: 'offline' });

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

  // Poll for current live event from schedule (optional - only for show name fallback)
  // WebSocket metadata is the source of truth for live status
  const checkSchedule = useCallback(async () => {
    try {
      const response = await fetch('/api/live/current');
      const data = await response.json();

      if (data.success && data.currentEvent) {
        // Only update content if WebSocket hasn't provided it
        // Never override WebSocket's live status
        setLiveMetadata(prev => {
          // If WebSocket says we're live, keep that status
          // Only update content if we don't have a title from WebSocket
          if (prev.status === 'live') {
            return {
              ...prev,
              content: {
                ...prev.content,
                // Only fill in missing fields from schedule
                title: prev.content?.title || data.currentEvent.showName,
                artist: prev.content?.artist || data.currentEvent.artists?.[0]?.name,
                image: prev.content?.image || data.currentEvent.imageUrl,
              },
            };
          }
          // If WebSocket says offline, use schedule data
          return {
            status: 'live',
            content: {
              title: data.currentEvent.showName,
              artist: data.currentEvent.artists?.[0]?.name,
              image: data.currentEvent.imageUrl,
            },
          };
        });
      }
      // Don't mark as offline if schedule has no event - WebSocket is the source of truth
    } catch (error) {
      console.error('Error checking schedule:', error);
    }
  }, []);

  // Check schedule on mount only (for initial show name if WebSocket hasn't connected yet)
  // WebSocket is the primary source of truth, schedule is just a fallback for show names
  useEffect(() => {
    // Only check once on mount - WebSocket will handle real-time updates
    checkSchedule();
  }, [checkSchedule]);

  // Initialize audio element ONLY when we have a live event
  useEffect(() => {
    // Only initialize audio if we have a live event
    if (!currentLiveEvent) {
      // Clean up audio if no live event
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
  }, [currentLiveEvent, liveVolume, pauseLive]);

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
          const metadata = data as
            | {
                status?: string;
                content?: { title?: string; artist?: string; image?: string; name?: string };
                metadata?: { bitrate?: number; listeners?: number; title?: string; artist?: string };
              }
            | undefined;
          if (metadata) {
            console.log('Received metadata:', metadata);
            
            // Consider it live if status is 'live', 'defaultPlaylist', or any non-empty status
            // RadioCult sends 'defaultPlaylist' when there's content playing
            const isLive = metadata.status === 'live' || 
                          metadata.status === 'defaultPlaylist' || 
                          (metadata.status && metadata.status !== 'offline');
            
            // Extract content from metadata.content or metadata.metadata
            // Prioritize current track (metadata.title) over playlist name (content.name)
            const contentTitle = metadata.metadata?.title || 
                                metadata.content?.title || 
                                metadata.content?.name;
            const contentArtist = metadata.metadata?.artist || 
                                 metadata.content?.artist;
            
            // WebSocket metadata is the source of truth - always update when received
            setLiveMetadata({
              status: (isLive ? 'live' : 'offline') as 'live' | 'offline',
              content: {
                title: contentTitle,
                artist: contentArtist,
                image: metadata.content?.image,
              },
              metadata: metadata.metadata,
            });

            // Reset metadata timeout
            if (metadataTimeoutRef.current) {
              clearTimeout(metadataTimeoutRef.current);
            }

            // Set offline after 2 minutes of no updates
            metadataTimeoutRef.current = setTimeout(() => {
              setLiveMetadata(prev => ({ ...prev, status: 'offline' }));
            }, 120000);
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

    if (isLivePlaying && currentLiveEvent) {
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
  }, [isLivePlaying, currentLiveEvent, streamUrl, pauseLive]);

  const handlePlayPause = () => {
    // If we don't have a currentLiveEvent but we detected something live via WebSocket,
    // create a temporary event object from the metadata
    let eventToPlay = currentLiveEvent;

    if (!eventToPlay && liveMetadata.status === 'live') {
      eventToPlay = {
        showName: liveMetadata.content?.title || 'Live Show',
        ...liveMetadata.content,
      };
    }

    if (!eventToPlay) return;

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

  const hasLive = Boolean(currentLiveEvent);
  // Prioritize WebSocket metadata - if it says live, we're live (even if schedule API doesn't find an event)
  const isActuallyLive = liveMetadata.status === 'live' || hasLive;

  // Use metadata from WebSocket if available, fallback to event data
  // If WebSocket shows content but no title, show a default message
  const displayName =
    liveMetadata.content?.title || 
    currentLiveEvent?.showName || 
    (liveMetadata.status === 'live' ? 'Live Now' : 'Nothing currently live');

  return (
    <div className='fixed top-0 bg-almostblack text-white dark:bg-black dark:text-white z-50 flex items-center transition-all duration-300 h-7 left-0 right-0 max-w-full'>
      <div className='ml-4 flex items-center shrink-0 transition-opacity duration-200'>
        <button
          className='rounded-full transition-colors disabled:opacity-100 text-white'
          disabled={!isActuallyLive}
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
