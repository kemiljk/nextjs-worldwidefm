import { z } from 'zod';
import { forgotPassword } from '@/cosmic/blocks/user-management/actions';
import { appError, appJson, readJson } from '@/lib/app-api';

const ForgotPasswordBody = z.object({ email: z.string().trim().email().max(320) });

export async function POST(request: Request) {
  const parsed = ForgotPasswordBody.safeParse(await readJson(request));
  if (!parsed.success) return appError('Enter a valid email address.', 400);

  const formData = new FormData();
  formData.set('email', parsed.data.email);
  await forgotPassword(formData);

  // Same answer whether or not the account exists.
  return appJson({ status: 'reset_email_sent_if_account_exists' }, 202);
}
