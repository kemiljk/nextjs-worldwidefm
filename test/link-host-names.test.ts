import { describe, expect, it } from 'bun:test';
import { instagramProfile } from '@/lib/instagram';
import { linkHostNames } from '@/lib/link-host-names';

const coco = { title: 'Coco Maria', metadata: { instagram: '@cocomaria' } };

describe('instagramProfile', () => {
  it('accepts handles and profile URLs, rejects anything else', () => {
    expect(instagramProfile('@zaereo')?.url).toBe('https://www.instagram.com/zaereo/');
    expect(instagramProfile('https://www.instagram.com/worldwide.fm/?hl=en')?.handle).toBe(
      'worldwide.fm'
    );
    expect(instagramProfile('https://evil.example/zaereo')).toBeNull();
    expect(instagramProfile('not a handle!')).toBeNull();
    expect(instagramProfile(undefined)).toBeNull();
  });
});

describe('linkHostNames', () => {
  it('links host names in show copy to their Instagram', () => {
    const html = linkHostNames('<p>Coco Maria hosts Breakfast Club.</p>', [coco]);
    expect(html).toBe(
      '<p><a href="https://www.instagram.com/cocomaria/" target="_blank" rel="noopener noreferrer">Coco Maria</a> hosts Breakfast Club.</p>'
    );
  });

  it('links every mention and ignores case', () => {
    const html = linkHostNames('<p>COCO MARIA returns. Thanks, coco maria!</p>', [coco]);
    expect(html.match(/<a /g)).toHaveLength(2);
    expect(html).toContain('>COCO MARIA</a>');
  });

  it('leaves hosts without an Instagram, and copy that already links them, alone', () => {
    const plain = '<p>Luke Una plays.</p>';
    expect(linkHostNames(plain, [{ title: 'Luke Una', metadata: {} }])).toBe(plain);
    const linked = '<p><a href="https://example.com">Coco Maria</a></p>';
    expect(linkHostNames(linked, [coco])).toBe(linked);
  });

  it('does not touch tags, attributes or parts of longer words', () => {
    const html = '<p title="Coco Maria">Cocoa Mariana</p><img alt="Coco Maria">';
    expect(linkHostNames(html, [coco])).toBe(html);
  });

  it('matches names containing an ampersand and prefers the longer name', () => {
    const hosts = [
      { title: 'Tom', metadata: { instagram: 'tom' } },
      { title: 'Tom & Jerry', metadata: { instagram: 'tomandjerry' } },
    ];
    const html = linkHostNames('<p>Tom &amp; Jerry meet Tom.</p>', hosts);
    expect(html).toContain('instagram.com/tomandjerry/');
    expect(html).toContain('>Tom &amp; Jerry</a>');
    expect(html).toContain(
      'instagram.com/tom/" target="_blank" rel="noopener noreferrer">Tom</a>.'
    );
  });

  it('handles missing input', () => {
    expect(linkHostNames('', [coco])).toBe('');
    expect(linkHostNames('<p>Coco Maria</p>', null)).toBe('<p>Coco Maria</p>');
    expect(linkHostNames('<p>Coco Maria</p>', [])).toBe('<p>Coco Maria</p>');
  });
});
