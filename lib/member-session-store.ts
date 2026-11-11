import { cosmic } from '@/lib/cosmic-config';
import {
  createMemberSessionToken,
  memberSessionDigest,
  parseMemberSessionToken,
  sessionExpiry,
  sessionIsValid,
} from '@/lib/member-session';

// Cosmic storage for member sessions, shared by the website cookie and the
// apps' bearer tokens. Sessions are `member-sessions` objects whose slug is a
// digest of the token (see lib/member-session.ts).

export async function createMemberSession(userId: string, passwordHash: string): Promise<string> {
  const token = createMemberSessionToken(userId);
  await cosmic.objects.insertOne({
    type: 'member-sessions',
    title: 'Member session',
    slug: memberSessionDigest(token, passwordHash),
    status: 'published',
    metadata: { expires_at: sessionExpiry() },
  });
  return token;
}

export async function resolveMemberSessionToken(token: string | null | undefined) {
  const parsed = parseMemberSessionToken(token ?? undefined);
  if (!token || !parsed) return null;

  try {
    const result = await cosmic.objects
      .findOne({
        type: 'users',
        id: parsed.userId,
        'metadata.active_status': true,
        'metadata.email_verified': true,
      })
      .props(['id', 'title', 'metadata'])
      .depth(1);
    const account = result?.object;
    const metadata = account?.metadata;
    if (!account || typeof metadata?.password !== 'string' || !metadata.password) return null;

    const sessionResult = await cosmic.objects
      .findOne({ type: 'member-sessions', slug: memberSessionDigest(token, metadata.password) })
      .props(['id', 'metadata.expires_at'])
      .depth(0);
    const session = sessionResult?.object;
    if (!session || !sessionIsValid(session.metadata?.expires_at)) return null;

    const name =
      account.title ||
      [metadata.first_name, metadata.last_name].filter(Boolean).join(' ') ||
      metadata.name ||
      metadata.email;
    const image =
      metadata.avatar?.imgix_url || metadata.image?.imgix_url || metadata.avatar || metadata.image;
    return {
      token,
      sessionId: session.id as string,
      expiresAt: session.metadata.expires_at as string,
      account,
      user: { id: account.id, name, email: metadata.email, image },
    };
  } catch (error) {
    // Missing accounts or sessions are invalid; infrastructure failures must
    // propagate so sign-out does not report revocation when it failed.
    if ((error as { status?: number })?.status === 404) return null;
    throw error;
  }
}

export async function deleteMemberSession(sessionId: string) {
  await cosmic.objects.deleteOne(sessionId);
}
