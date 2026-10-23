export type PostKind = 'article' | 'video';

/**
 * Whether a post is a video post, from its content rather than the Cosmic "type"
 * dropdown: that field's options are labelled Compact/Wide, editors use it as a
 * width choice, and every post is currently set to Wide.
 */
export function getPostKind(post: {
  metadata?: { youtube_video?: string | null } | null;
}): PostKind {
  return post.metadata?.youtube_video?.trim() ? 'video' : 'article';
}

/** Cosmic query clause matching posts of one kind (see getPostKind). */
export function postKindQuery(kind: PostKind): Record<string, unknown> {
  return kind === 'video'
    ? { 'metadata.youtube_video': { $regex: '\\S' } }
    : { 'metadata.youtube_video': { $in: ['', null] } };
}
