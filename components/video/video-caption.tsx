import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const URL_PATTERN = /(\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

interface VideoCaptionProps {
  description?: string | null;
  className?: string;
}

function linkify(line: string): ReactNode[] {
  return line.split(URL_PATTERN).map((part, index) =>
    index % 2 === 1 ? (
      <a key={index} href={part} target='_blank' rel='noopener noreferrer'>
        {part}
      </a>
    ) : (
      part
    )
  );
}

/**
 * Video description as readable body copy: paragraphs, line breaks and working
 * links. Built as React elements (no HTML injection) so it also works in client
 * components; any stray tags in the copy are dropped.
 */
export function VideoCaption({ description, className }: VideoCaptionProps) {
  const text = description
    ?.replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\r\n?/g, '\n')
    .trim();
  if (!text) return null;

  const paragraphs = text.split(/\n\s*\n/);

  return (
    <div
      className={cn(
        'font-sans normal-case text-left text-b3 leading-6 space-y-4 max-w-prose',
        'text-almostblack/80 dark:text-white/80 [&_a]:underline [&_a]:underline-offset-2',
        className
      )}
    >
      {paragraphs.map((paragraph, index) => (
        <p key={index}>
          {paragraph
            .trim()
            .split('\n')
            .map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                {linkify(line)}
              </Fragment>
            ))}
        </p>
      ))}
    </div>
  );
}
