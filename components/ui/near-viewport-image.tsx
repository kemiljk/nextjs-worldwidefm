'use client';

import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react';

export const DEFERRED_IMAGE_PLACEHOLDER =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E';

/** Reserve the image box, but let visible artwork finish before distant cards download. */
export function NearViewportImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  const ref = useRef<HTMLImageElement>(null);
  const [near, setNear] = useState(false);
  const eager = props.loading === 'eager';
  useEffect(() => {
    if (eager || near) return;
    if (!('IntersectionObserver' in window)) {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [eager, near]);

  if (eager) return <img {...props} />;
  return (
    <>
      <img
        {...props}
        ref={ref}
        src={near ? props.src : DEFERRED_IMAGE_PLACEHOLDER}
        srcSet={near ? props.srcSet : undefined}
        data-deferred-image={near ? undefined : 'true'}
        onLoad={near ? props.onLoad : undefined}
        onError={near ? props.onError : undefined}
      />
      <noscript>
        <img {...props} />
      </noscript>
    </>
  );
}
