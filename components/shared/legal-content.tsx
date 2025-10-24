import { sanitizeHtml } from '@/lib/sanitize-html';

interface LegalContentProps {
  title: string;
  content: string;
  lastUpdated?: string;
}

export default function LegalContent({ title, content, lastUpdated }: LegalContentProps) {
  const sanitizedContent = sanitizeHtml(content);

  return (
    <div className='max-w-4xl mx-auto py-8'>
      <div className='mb-8'>
        <h1 className='text-4xl font-display font-bold mb-4'>{title}</h1>
        {lastUpdated && (
          <p className='text-muted-foreground text-sm'>Last updated: {lastUpdated}</p>
        )}
      </div>

      <div
        className='prose dark:prose-invert prose-lg max-w-none prose-headings:font-display prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-p:text-base prose-p:leading-relaxed prose-ul:my-4 prose-ol:my-4 prose-li:my-1'
        dangerouslySetInnerHTML={{ __html: sanitizedContent }}
      />
    </div>
  );
}
