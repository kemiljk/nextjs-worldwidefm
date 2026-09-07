'use client';

import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react';

const placeholder = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

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
        src={near ? props.src : placeholder}
        srcSet={near ? props.srcSet : undefined}
        onLoad={near ? props.onLoad : undefined}
      />
      <noscript>
        <img {...props} />
      </noscript>
    </>
  );
}
