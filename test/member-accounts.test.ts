/// <reference types="bun-types" />
process.env.RESEND_API_KEY = 're_test';
process.env.NEXT_PUBLIC_APP_URL = 'https://example.test';

import { beforeEach, describe, expect, it, mock } from 'bun:test';
import bcrypt from 'bcryptjs';

// --- In-memory stand-ins for Cosmic, Resend and next/headers ----------------

type StoredObject = {
  id: string;
  type: string;
  title: string;
  slug?: string;
  metadata: Record<string, any>;
};

const objects = new Map<string, StoredObject>();
let insertCount = 0;
const sentEmails: { to: string; html: string }[] = [];
let requestHeaders = new Headers();
const requestCookies = new Map<string, string>();

function notFound() {
  return Object.assign(new Error('No objects found'), { status: 404 });
}

function matches(object: StoredObject, query: Record<string, unknown>) {
  return Object.entries(query).every(([key, value]) => {
    if (key === 'id') return object.id === value;
    if (key === 'type') return object.type === value;
    if (key === 'slug') return object.slug === value;
    if (key.startsWith('metadata.'))
      return object.metadata[key.slice('metadata.'.length)] === value;
    return false;
  });
}

function chain<T>(run: () => T) {
  const query = {
    props: () => query,
    depth: () => query,
    then: (resolve: (value: T) => unknown, reject: (error: unknown) => unknown) => {
      try {
        return Promise.resolve(run()).then(resolve, reject);
      } catch (error) {
        return Promise.reject(error).then(resolve, reject);
      }
    },
  };
  return query;
}

mock.module('@/lib/cosmic-config', () => ({
  cosmic: {
    objects: {
      findOne: (query: Record<string, unknown>) =>
        chain(() => {
          const object = [...objects.values()].find(item => matches(item, query));
          if (!object) throw notFound();
          return { object: structuredClone(object) };
        }),
      insertOne: async (data: Omit<StoredObject, 'id'>) => {
        const object = { ...data, id: `${data.type}-${++insertCount}` } as StoredObject;
        objects.set(object.id, object);
        return { object };
      },
      updateOne: async (id: string, data: Partial<StoredObject>) => {
        const object = objects.get(id);
        if (!object) throw notFound();
        if (data.title) object.title = data.title;
        object.metadata = { ...object.metadata, ...data.metadata };
        return { object: structuredClone(object) };
      },
      deleteOne: async (id: string) => {
        objects.delete(id);
        return {};
      },
    },
    media: { insertOne: async () => ({ media: { name: 'avatar.jpg' } }) },
  },
}));

mock.module('resend', () => ({
  Resend: class {
    emails = {
      send: async (message: { to: string; html: string }) => {
        sentEmails.push(message);
        return { id: 'email' };
      },
    };
  },
}));

mock.module('next/headers', () => ({
  headers: async () => requestHeaders,
  cookies: async () => ({
    get: (name: string) =>
      requestCookies.has(name) ? { name, value: requestCookies.get(name)! } : undefined,
    set: (name: string, value: string) => requestCookies.set(name, value),
    delete: (name: string) => requestCookies.delete(name),
  }),
}));

mock.module('next/cache', () => ({
  revalidateTag: () => undefined,
  revalidatePath: () => undefined,
  unstable_noStore: () => undefined,
  unstable_cache: <T>(fn: T) => fn,
  cacheTag: () => undefined,
  cacheLife: () => undefined,
}));

mock.module('server-only', () => ({}));

// The actions module pulls these in for unrelated features; stub them so this
// file doesn't depend on (or get broken by) other tests' Cosmic mocks.
mock.module('@/lib/schedule-service', () => ({
  getWeeklySchedule: async () => ({ scheduleItems: [] }),
}));
mock.module('@/lib/get-canonical-genres', () => ({ getCanonicalGenres: async () => [] }));

const sessions = await import('@/lib/member-session-store');
const { MEMBER_SESSION_COOKIE } = await import('@/lib/member-session');
const actions = await import('@/cosmic/blocks/user-management/actions');
const loginRoute = await import('@/app/api/app/v1/auth/login/route');
const logoutRoute = await import('@/app/api/app/v1/auth/logout/route');
const forgotRoute = await import('@/app/api/app/v1/auth/forgot-password/route');
const meRoute = await import('@/app/api/app/v1/me/route');
const passwordRoute = await import('@/app/api/app/v1/me/password/route');
const favouritesRoute = await import('@/app/api/app/v1/me/favourites/[kind]/[id]/route');

// --- Helpers ----------------------------------------------------------------

const PASSWORD = 'correct horse 1';
// Cosmic object ids are 24 hex characters; the app API rejects anything else.
const ALICE = 'a1'.repeat(12);
const BOB = 'b2'.repeat(12);

async function addUser(id: string, email: string, extra: Record<string, unknown> = {}) {
  objects.set(id, {
    id,
    type: 'users',
    title: `Member ${id}`,
    metadata: {
      email,
      password: await bcrypt.hash(PASSWORD, 4),
      active_status: true,
      email_verified: true,
      favourite_genres: [],
      ...extra,
    },
  });
}

function newSession(userId: string) {
  return sessions.createMemberSession(userId, objects.get(userId)!.metadata.password);
}

async function sessionUserId(token: string | null | undefined) {
  return (await sessions.resolveMemberSessionToken(token))?.user.id ?? null;
}

function sessionObjects() {
  return [...objects.values()].filter(object => object.type === 'member-sessions');
}

function signedInAs(token: string | null) {
  requestHeaders = new Headers(token ? { authorization: `Bearer ${token}` } : {});
}

function jsonRequest(body: unknown, method = 'POST') {
  return new Request('https://example.test/api', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function favourite(kind: string, id: string, method: 'PUT' | 'DELETE') {
  const handler = method === 'PUT' ? favouritesRoute.PUT : favouritesRoute.DELETE;
  return handler(new Request('https://example.test/api', { method }), {
    params: Promise.resolve({ kind, id }),
  });
}

async function appLogin(email: string, password = PASSWORD) {
  signedInAs(null);
  return loginRoute.POST(jsonRequest({ email, password }));
}

beforeEach(async () => {
  objects.clear();
  sentEmails.length = 0;
  requestCookies.clear();
  signedInAs(null);
  await addUser(ALICE, 'alice@example.test');
  await addUser(BOB, 'bob@example.test');
});

// --- Sessions ---------------------------------------------------------------

describe('member session store', () => {
  it('stores only a digest of the token and resolves it', async () => {
    const token = await newSession(ALICE);

    expect(token.startsWith(`${ALICE}.`)).toBe(true);
    expect(JSON.stringify([...objects.values()])).not.toContain(token);
    expect(await sessionUserId(token)).toBe(ALICE);
  });

  it('rejects tampered tokens and tokens moved to another user', async () => {
    const token = await newSession(ALICE);
    const secret = token.slice(ALICE.length + 1);

    expect(await sessionUserId(`${token.slice(0, -1)}x`)).toBeNull();
    expect(await sessionUserId(`${BOB}.${secret}`)).toBeNull();
    expect(await sessionUserId(ALICE)).toBeNull();
    expect(await sessionUserId('')).toBeNull();
  });

  it('rejects expired sessions and sessions from before a password change', async () => {
    const expiring = await newSession(ALICE);
    const other = await newSession(ALICE);

    sessionObjects()[0].metadata.expires_at = '2020-01-01T00:00:00Z';
    expect(await sessionUserId(expiring)).toBeNull();
    expect(await sessionUserId(other)).toBe(ALICE);

    objects.get(ALICE)!.metadata.password = await bcrypt.hash('changed 2', 4);
    expect(await sessionUserId(other)).toBeNull();
  });
});

// --- App API ----------------------------------------------------------------

describe('app API', () => {
  it('signs in and returns the profile without secrets', async () => {
    const response = await appLogin('ALICE@example.test');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.user).toMatchObject({ id: ALICE, email: 'alice@example.test' });
    expect(JSON.stringify(body)).not.toContain('password');

    signedInAs(body.token);
    const me = await (await meRoute.GET()).json();
    expect(me.user.id).toBe(ALICE);
    expect(JSON.stringify(me)).not.toMatch(/password/);
  });

  it('rejects bad passwords, unverified members and missing tokens', async () => {
    expect((await appLogin('alice@example.test', 'wrong password 1')).status).toBe(401);

    objects.get(ALICE)!.metadata.email_verified = false;
    expect((await appLogin('alice@example.test')).status).toBe(403);

    signedInAs(null);
    expect((await meRoute.GET()).status).toBe(401);
    signedInAs(`${ALICE}.not-a-real-token-but-long-enough-to-parse-000`);
    expect((await meRoute.GET()).status).toBe(401);
  });

  it('treats tokens with a non-Cosmic id as signed out', async () => {
    signedInAs('not-an-id.abcdefghijklmnopqrstuvwxyzabcdefghijklmnopq');
    expect((await meRoute.GET()).status).toBe(401);
  });

  it('ignores the web cookie on app routes', async () => {
    requestCookies.set(MEMBER_SESSION_COOKIE, await newSession(ALICE));
    signedInAs(null);
    expect((await meRoute.GET()).status).toBe(401);
  });

  it('adds and removes favourites idempotently', async () => {
    const { token } = await (await appLogin('alice@example.test')).json();
    signedInAs(token);

    await favourite('genres', 'genre1', 'PUT');
    const again = await (await favourite('genres', 'genre1', 'PUT')).json();
    expect(again.favourites.genres).toEqual(['genre1']);

    await favourite('takeovers', 'takeover1', 'PUT');
    expect(objects.get(ALICE)!.metadata.favourite_takeovers).toEqual(['takeover1']);

    const removed = await (await favourite('genres', 'genre1', 'DELETE')).json();
    expect(removed.favourites.genres).toEqual([]);

    expect((await favourite('passwords', 'x', 'PUT')).status).toBe(404);
    expect((await favourite('genres', '../bob', 'PUT')).status).toBe(400);
    expect(objects.get(BOB)!.metadata.favourite_genres).toEqual([]);
  });

  it('changes the password, ends every old session and returns a new token', async () => {
    const { token: phone } = await (await appLogin('alice@example.test')).json();
    const { token: tablet } = await (await appLogin('alice@example.test')).json();

    signedInAs(phone);
    const wrong = await passwordRoute.POST(
      jsonRequest({ currentPassword: 'nope', newPassword: 'new password 2' })
    );
    expect(wrong.status).toBe(403);

    const changed = await passwordRoute.POST(
      jsonRequest({ currentPassword: PASSWORD, newPassword: 'new password 2' })
    );
    const { token: renewed } = await changed.json();
    expect(changed.status).toBe(200);
    expect(await sessionUserId(phone)).toBeNull();
    expect(await sessionUserId(tablet)).toBeNull();
    expect(await sessionUserId(renewed)).toBe(ALICE);
    expect((await appLogin('alice@example.test', 'new password 2')).status).toBe(200);
  });

  it('updates only the profile fields that are sent', async () => {
    const { token } = await (await appLogin('alice@example.test')).json();
    signedInAs(token);
    objects.get(ALICE)!.metadata.first_name = 'Alice';

    const response = await meRoute.PATCH(
      jsonRequest({ name: 'DJ Alice', lastName: 'Smith' }, 'PATCH')
    );
    expect(response.status).toBe(200);
    expect(objects.get(ALICE)!.title).toBe('DJ Alice');
    expect(objects.get(ALICE)!.metadata).toMatchObject({
      first_name: 'Alice',
      last_name: 'Smith',
    });
  });

  it('signs out and deletes the account', async () => {
    const { token } = await (await appLogin('alice@example.test')).json();
    signedInAs(token);
    await logoutRoute.POST();
    expect((await meRoute.GET()).status).toBe(401);

    const { token: again } = await (await appLogin('alice@example.test')).json();
    signedInAs(again);
    expect((await meRoute.DELETE()).status).toBe(200);
    expect(objects.has(ALICE)).toBe(false);
  });

  it('answers forgot-password the same way for unknown emails', async () => {
    const known = await forgotRoute.POST(jsonRequest({ email: 'alice@example.test' }));
    const unknown = await forgotRoute.POST(jsonRequest({ email: 'nobody@example.test' }));
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
  });
});

// --- Website server actions -------------------------------------------------

describe('website server actions', () => {
  async function webLogin(email: string) {
    const formData = new FormData();
    formData.set('email', email);
    formData.set('password', PASSWORD);
    const result = await actions.login(formData);
    signedInAs(null);
    return result;
  }

  it('uses a session token cookie instead of the user id', async () => {
    requestCookies.set('user_id', ALICE);
    expect(await actions.getUserFromCookie()).toBeNull();

    await webLogin('alice@example.test');
    expect(requestCookies.has('user_id')).toBe(false);
    expect(requestCookies.get(MEMBER_SESSION_COOKIE)).not.toBe(ALICE);
    expect((await actions.getUserFromCookie())?.id).toBe(ALICE);
  });

  it("refuses to read or change another member's data", async () => {
    await webLogin('alice@example.test');

    expect((await actions.getUserData(BOB)).error).toBe('Unauthorized');
    expect((await actions.addFavouriteGenre(BOB, { id: 'genre1' } as any)).success).toBe(false);
    expect(objects.get(BOB)!.metadata.favourite_genres).toEqual([]);

    const own = await actions.getUserData(ALICE);
    expect(own.data?.id).toBe(ALICE);
    expect(JSON.stringify(own.data)).not.toMatch(/password/);
  });

  it('stores reset tokens hashed and signs out everywhere after a reset', async () => {
    const session = await newSession(ALICE);
    const formData = new FormData();
    formData.set('email', 'alice@example.test');
    await actions.forgotPassword(formData);

    const rawToken = sentEmails[0].html.match(/token=([a-f0-9]+)/)![1];
    expect(objects.get(ALICE)!.metadata.reset_password_token).not.toBe(rawToken);

    const reset = new FormData();
    reset.set('password', 'brand new 3');
    expect((await actions.resetPassword(rawToken, reset)).success).toBe(true);
    expect(await sessionUserId(session)).toBeNull();
  });

  it('logs out by revoking the session', async () => {
    await webLogin('alice@example.test');
    const token = requestCookies.get(MEMBER_SESSION_COOKIE)!;
    await actions.logoutUser();
    expect(requestCookies.has(MEMBER_SESSION_COOKIE)).toBe(false);
    expect(await sessionUserId(token)).toBeNull();
  });
});
