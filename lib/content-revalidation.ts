import { revalidateTag } from 'next/cache';
import { changedContentTags } from './content-cache-policy';

export function revalidateContent(type: string, slug?: string) {
  const tags = changedContentTags(type, slug);
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
  return tags;
}
