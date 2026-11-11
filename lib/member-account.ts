import bcrypt from 'bcryptjs';
import { revalidateTag } from 'next/cache';
import { cosmic } from '@/lib/cosmic-config';

// Shared member account logic for the website's server actions and the
// /api/app/v1 routes used by the iOS and Android apps. Callers must pass a
// user id that came from a verified session, never one sent by a client.

export const FAVOURITE_FIELDS = {
  genres: 'favourite_genres',
  hosts: 'favourite_hosts',
  takeovers: 'favourite_takeovers',
  'listen-later': 'listen_later',
} as const;

export type FavouriteKind = keyof typeof FAVOURITE_FIELDS;
export type FavouriteField = (typeof FAVOURITE_FIELDS)[FavouriteKind];

export function isValidPassword(password: unknown): password is string {
  return (
    typeof password === 'string' &&
    password.length >= 8 &&
    /[A-Za-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

export type CredentialsResult =
  | { status: 'ok'; user: any }
  | { status: 'unverified' }
  | { status: 'invalid' };

export async function verifyCredentials(
  email: string,
  password: string
): Promise<CredentialsResult> {
  let user: any;
  try {
    ({ object: user } = await cosmic.objects
      .findOne({
        type: 'users',
        'metadata.email': email.toLowerCase(),
        'metadata.active_status': true,
      })
      .props(['id', 'title', 'metadata'])
      .depth(0));
  } catch {
    return { status: 'invalid' };
  }

  const storedHash = user?.metadata?.password;
  if (typeof storedHash !== 'string' || !(await bcrypt.compare(password, storedHash))) {
    return { status: 'invalid' };
  }
  if (!user.metadata.email_verified) return { status: 'unverified' };
  return { status: 'ok', user };
}

function idsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => (typeof item === 'string' ? item : item?.id || item?._id))
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

export async function updateFavourites(
  userId: string,
  field: FavouriteField,
  requestedIds: Array<string | null | undefined>,
  action: 'add' | 'remove'
) {
  const itemIds = requestedIds.filter((id): id is string => typeof id === 'string' && id !== '');
  if (!userId || itemIds.length === 0) throw new Error('Invalid user ID or item ID');

  const { object: user } = await cosmic.objects
    .findOne({ id: userId, type: 'users' })
    .props(['metadata'])
    .depth(0);
  if (!user) throw new Error('User not found');

  const current = idsOf(user.metadata?.[field]);
  const changes = new Set(itemIds);
  const updated =
    action === 'add'
      ? Array.from(new Set([...current, ...itemIds]))
      : current.filter(id => !changes.has(id));

  if (updated.length === current.length && updated.every((id, i) => id === current[i])) {
    return user;
  }

  // Only send the one field: Cosmic leaves the other metadata untouched.
  const { object: updatedUser } = await cosmic.objects.updateOne(userId, {
    metadata: { [field]: updated },
  });
  revalidateTag('user-profile', { expire: 0 });
  return updatedUser;
}

/** The member as the apps see it: profile plus favourite ids, no secrets. */
export function toAppUser(object: any) {
  const metadata = object?.metadata ?? {};
  const name = object?.title || [metadata.first_name, metadata.last_name].filter(Boolean).join(' ');
  return {
    id: object.id as string,
    name: name || metadata.email,
    firstName: metadata.first_name ?? null,
    lastName: metadata.last_name ?? null,
    email: metadata.email as string,
    emailVerified: Boolean(metadata.email_verified),
    avatarUrl: metadata.avatar?.imgix_url ?? metadata.avatar?.url ?? null,
    favourites: {
      genres: idsOf(metadata.favourite_genres),
      hosts: idsOf(metadata.favourite_hosts),
      takeovers: idsOf(metadata.favourite_takeovers),
      listenLater: idsOf(metadata.listen_later),
    },
  };
}
