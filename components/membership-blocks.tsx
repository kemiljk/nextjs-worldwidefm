import Link from 'next/link';
import { SafeHtml } from '@/components/ui/safe-html';
import { buildImgixUrl, QUALITY_PRESETS } from '@/lib/image-utils';
import {
  groupMembershipBlocks,
  parseMembershipBlocks,
  type MembershipBlock,
} from '@/lib/membership-blocks';

const BODY =
  'font-sans text-b6 space-y-4 [&_a]:underline [&_a]:underline-offset-2 [&_strong]:font-bold [&_em]:italic';

function Heading({ children }: { children: string }) {
  return children ? (
    <h2 className='font-display uppercase text-h7 md:text-h6 tracking-tight mb-4'>{children}</h2>
  ) : null;
}

function BlockLink({ href, children }: { href: string; children: string }) {
  const className =
    'inline-flex h-10 items-center border border-almostblack px-5 font-mono text-m7 uppercase hover:bg-almostblack hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-almostblack transition-colors';
  return href.startsWith('/') ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className} target='_blank' rel='noopener noreferrer'>
      {children}
    </a>
  );
}

function renderBlock(block: Exclude<MembershipBlock, { type: 'faq' }>, index: number) {
  switch (block.type) {
    case 'text':
      return (
        <section key={index} className='mx-auto max-w-3xl px-5 py-10'>
          <Heading>{block.heading}</Heading>
          {block.body && <SafeHtml content={block.body} type='editorial' className={BODY} />}
        </section>
      );
    case 'image-text':
      return (
        <section
          key={index}
          className={`mx-auto flex max-w-6xl flex-col items-center gap-8 px-5 py-10 md:gap-16 ${
            block.imagePosition === 'left' ? 'md:flex-row' : 'md:flex-row-reverse'
          }`}
        >
          {block.imageUrl && (
            <img
              src={buildImgixUrl(block.imageUrl, {
                width: 1000,
                quality: QUALITY_PRESETS.featured,
              })}
              alt={block.heading}
              loading='lazy'
              className='w-full md:w-1/2 h-auto object-cover'
            />
          )}
          <div className={block.imageUrl ? 'md:w-1/2' : 'w-full'}>
            <Heading>{block.heading}</Heading>
            {block.body && <SafeHtml content={block.body} type='editorial' className={BODY} />}
          </div>
        </section>
      );
    case 'cta':
      return (
        <section key={index} className='mx-auto max-w-3xl px-5 py-10 text-center'>
          <Heading>{block.heading}</Heading>
          {block.body && (
            <SafeHtml content={block.body} type='editorial' className={`${BODY} mb-6`} />
          )}
          {block.buttonHref && <BlockLink href={block.buttonHref}>{block.buttonText}</BlockLink>}
        </section>
      );
  }
}

/** Editor-managed content under the membership sign-up hero. Renders nothing when empty. */
export function MembershipBlocks({ blocks }: { blocks: unknown }) {
  const groups = groupMembershipBlocks(parseMembershipBlocks(blocks));
  if (groups.length === 0) return null;

  return (
    <div
      className='bg-background text-almostblack dark:text-white py-10'
      data-testid='membership-blocks'
    >
      {groups.map((group, index) =>
        group.kind === 'faq' ? (
          <section key={index} className='mx-auto max-w-3xl px-5 py-10'>
            <h2 className='sr-only'>Frequently asked questions</h2>
            <div className='divide-y divide-almostblack/20 border-y border-almostblack/20 dark:divide-white/20 dark:border-white/20'>
              {group.items.map((item, itemIndex) => (
                <details key={itemIndex} className='group py-4'>
                  <summary className='flex cursor-pointer list-none items-center justify-between gap-4 font-display uppercase text-h8 tracking-tight'>
                    {item.heading}
                    <span
                      aria-hidden='true'
                      className='font-mono group-open:rotate-45 transition-transform'
                    >
                      +
                    </span>
                  </summary>
                  <SafeHtml content={item.body} type='editorial' className={`${BODY} mt-3`} />
                </details>
              ))}
            </div>
          </section>
        ) : (
          renderBlock(group.block, index)
        )
      )}
    </div>
  );
}
