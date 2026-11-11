import 'server-only';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { resolveMemberSessionToken } from '@/lib/member-session-store';

// Helpers for the /api/app/v1 routes used by the iOS and Android apps.

export function appJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function appError(error: string, status: number) {
  return appJson({ error }, status);
}

export const unauthorized = () => appError('Unauthorized', 401);

/** The bearer token sent by the app. Cookies are deliberately ignored here. */
export async function getBearerToken(): Promise<string | null> {
  const authorization = (await headers()).get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  return authorization.slice('Bearer '.length).trim() || null;
}

// Cosmic object ids are 24 hex characters. Cosmic answers other ids with an
// error rather than a 404, so reject them here and keep real failures as errors.
const COSMIC_ID_TOKEN = /^[a-f0-9]{24}\./;

/** The session and member account behind the request's bearer token, or null. */
export async function getAppSession() {
  const token = await getBearerToken();
  if (!token || !COSMIC_ID_TOKEN.test(token)) return null;
  return resolveMemberSessionToken(token);
}

/** The member account behind the request's bearer token, or null. */
export async function getAppUser() {
  return (await getAppSession())?.account ?? null;
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}
