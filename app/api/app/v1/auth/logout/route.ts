import { appJson, getAppSession } from '@/lib/app-api';
import { deleteMemberSession } from '@/lib/member-session-store';

export async function POST() {
  const session = await getAppSession();
  if (session) await deleteMemberSession(session.sessionId);
  return appJson({ status: 'signed_out' });
}
