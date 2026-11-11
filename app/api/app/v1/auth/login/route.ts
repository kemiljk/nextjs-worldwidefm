import { z } from 'zod';
import { appError, appJson, readJson } from '@/lib/app-api';
import { toAppUser, verifyCredentials } from '@/lib/member-account';
import { createMemberSession } from '@/lib/member-session-store';

const LoginBody = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  const parsed = LoginBody.safeParse(await readJson(request));
  if (!parsed.success) return appError('Invalid email or password.', 400);

  const result = await verifyCredentials(parsed.data.email, parsed.data.password);
  if (result.status === 'unverified') {
    return appError('Please verify your email address before signing in.', 403);
  }
  if (result.status !== 'ok') return appError('Invalid email or password.', 401);

  const token = await createMemberSession(result.user.id, result.user.metadata.password);
  return appJson({ token, user: toAppUser(result.user) });
}
