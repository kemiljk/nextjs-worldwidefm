'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import VideoGrid from '@/components/video/video-grid';
import { Search } from '@/components/search';
import { VideoObject } from '@/lib/cosmic-config';

interface VideosClientProps {
  initialVideos: VideoObject[];
}

export default function VideosClient({ initialVideos }: VideosClientProps) {
  const [videos, setVideos] = useState<VideoObject[]>(initialVideos);
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const search = searchParams.get('search');
    if (search) {
      setSearchTerm(search);
    }
  }, [searchParams]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    const params = new URLSearchParams();
    if (term) {
      params.set('search', term);
    }
    router.push(`/videos${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const filteredVideos = useMemo(() => {
    if (!searchTerm) return videos;
    return videos.filter((video) => video.title.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [videos, searchTerm]);

  return (
    <>
      <div className='mb-8'>
        <Search
          value={searchTerm}
          onChange={handleSearch}
          placeholder='Search videos...'
          className='relative'
        />
      </div>
      {filteredVideos.length > 0 ? (
        <VideoGrid videos={filteredVideos} />
      ) : (
        <div className='text-center py-12'>
          <p className='text-lg text-gray-500'>No videos found</p>
        </div>
      )}
    </>
  );
}
