import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { looksLikeHtml, parseRichText, type RichTextNode } from '@/lib/rich-text';

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

function renderNodes(nodes: RichTextNode[], insideLink = false): ReactNode {
  return nodes.map((node, index) => {
    if (node.type === 'text') {
      // Bare URLs in the copy still become links, unless it is already inside one.
      return <Fragment key={index}>{insideLink ? node.text : linkify(node.text)}</Fragment>;
    }
    const children = renderNodes(node.children, insideLink || node.tag === 'a');
    switch (node.tag) {
      case 'br':
        return <br key={index} />;
      case 'a':
        return node.href ? (
          <a key={index} href={node.href} target='_blank' rel='noopener noreferrer'>
            {children}
          </a>
        ) : (
          <Fragment key={index}>{children}</Fragment>
        );
      case 'p':
        return <p key={index}>{children}</p>;
      case 'ul':
        return (
          <ul key={index} className='list-disc pl-5 space-y-1'>
            {children}
          </ul>
        );
      case 'ol':
        return (
          <ol key={index} className='list-decimal pl-5 space-y-1'>
            {children}
          </ol>
        );
      case 'li':
        return <li key={index}>{children}</li>;
      case 'strong':
        return <strong key={index}>{children}</strong>;
      case 'em':
        return <em key={index}>{children}</em>;
      case 'u':
        return <u key={index}>{children}</u>;
    }
  });
}

/**
 * Video description as readable body copy. Rich text from Cosmic (bold, italics,
 * named links, lists) is rendered as React elements; older plain-text captions
 * keep paragraphs, line breaks and auto-linked URLs. Nothing is injected as raw
 * HTML, so it works in server and client components alike.
 */
export function VideoCaption({ description, className }: VideoCaptionProps) {
  const source = description?.trim();
  if (!source) return null;

  const classes = cn(
    'font-sans normal-case text-left text-b3 leading-6 space-y-4 max-w-prose',
    'text-almostblack/80 dark:text-white/80 [&_a]:underline [&_a]:underline-offset-2',
    className
  );

  if (looksLikeHtml(source)) {
    return <div className={classes}>{renderNodes(parseRichText(source))}</div>;
  }

  const paragraphs = source.replace(/\r\n?/g, '\n').split(/\n\s*\n/);

  return (
    <div className={classes}>
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
