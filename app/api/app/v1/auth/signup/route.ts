import { z } from 'zod';
import { signUp } from '@/cosmic/blocks/user-management/actions';
import { appError, appJson, readJson } from '@/lib/app-api';

const SignUpBody = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).default(''),
  email: z.string().trim().pipe(z.email().max(320)),
  password: z.string().max(200),
});

export async function POST(request: Request) {
  const parsed = SignUpBody.safeParse(await readJson(request));
  if (!parsed.success) return appError('Enter your name, a valid email and a password.', 400);

  const formData = new FormData();
  for (const [key, value] of Object.entries(parsed.data)) formData.set(key, value);

  // Same flow as the website: creates an unverified member and emails a link.
  const result = await signUp(formData);
  if (!result.success) return appError(result.error ?? 'Sign up failed.', 400);
  return appJson({ status: 'verification_sent' }, 201);
}
