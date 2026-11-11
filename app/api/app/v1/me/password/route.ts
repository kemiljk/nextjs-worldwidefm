import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { cosmic } from '@/lib/cosmic-config';
import { appError, appJson, getAppUser, readJson, unauthorized } from '@/lib/app-api';
import { isValidPassword } from '@/lib/member-account';
import { createMemberSession } from '@/lib/member-session-store';

const ChangePasswordBody = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().max(200),
});

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return unauthorized();

  const parsed = ChangePasswordBody.safeParse(await readJson(request));
  if (!parsed.success) return appError('Enter your current and new password.', 400);

  const { currentPassword, newPassword } = parsed.data;
  const storedHash = user.metadata?.password;
  if (typeof storedHash !== 'string' || !(await bcrypt.compare(currentPassword, storedHash))) {
    return appError('Current password is incorrect.', 403);
  }
  if (!isValidPassword(newPassword)) {
    return appError(
      'Password must be at least 8 characters long and contain both letters and numbers.',
      400
    );
  }

  // Sessions are bound to the password hash, so this signs out every device.
  // Hand this one a fresh token so it stays signed in.
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await cosmic.objects.updateOne(user.id, { metadata: { password: passwordHash } });
  const token = await createMemberSession(user.id, passwordHash);
  return appJson({ status: 'password_changed', token });
}
