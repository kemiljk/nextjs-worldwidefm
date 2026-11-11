import { z } from 'zod';
import { cosmic } from '@/lib/cosmic-config';
import { appError, appJson, getAppUser, unauthorized } from '@/lib/app-api';
import { toAppUser } from '@/lib/member-account';

const MAX_AVATAR_BYTES = 10 * 1024 * 1024;

const optionalName = z.string().trim().max(100).optional();

// Every field is optional; omitted fields keep their current value.
const ProfileFields = z.object({
  name: optionalName,
  firstName: optionalName,
  lastName: optionalName,
});

export async function GET() {
  const user = await getAppUser();
  if (!user) return unauthorized();
  return appJson({ user: toAppUser(user) });
}

/** Display name and first/last name, plus an optional `avatar` image when sent as multipart form data. */
export async function PATCH(request: Request) {
  const user = await getAppUser();
  if (!user) return unauthorized();

  let fields: unknown;
  let avatar: File | null = null;
  try {
    if (request.headers.get('content-type')?.includes('multipart/form-data')) {
      const formData = await request.formData();
      const text = (key: string) => (formData.get(key) as string | null) ?? undefined;
      fields = { name: text('name'), firstName: text('firstName'), lastName: text('lastName') };
      const file = formData.get('avatar');
      avatar = file instanceof File && file.size > 0 ? file : null;
    } else {
      fields = await request.json();
    }
  } catch {
    return appError('Invalid request body.', 400);
  }

  const parsed = ProfileFields.safeParse(fields);
  if (!parsed.success) return appError('Names must be 100 characters or fewer.', 400);
  if (avatar && (!avatar.type.startsWith('image/') || avatar.size > MAX_AVATAR_BYTES)) {
    return appError('Avatar must be an image under 10 MB.', 400);
  }

  const { name, firstName, lastName } = parsed.data;
  const updates: { title?: string; metadata: Record<string, unknown>; thumbnail?: string } = {
    metadata: {},
  };
  // first_name is required on users, so an empty value never replaces it.
  if (firstName) updates.metadata.first_name = firstName;
  if (lastName !== undefined) updates.metadata.last_name = lastName;
  const title = name || [firstName, lastName].filter(Boolean).join(' ');
  if (title) updates.title = title;

  if (avatar) {
    const { media } = await cosmic.media.insertOne({
      media: {
        originalname: avatar.name || 'avatar.jpg',
        buffer: Buffer.from(await avatar.arrayBuffer()),
      },
    });
    updates.metadata.avatar = media.name;
    updates.thumbnail = media.name;
  }

  const { object } = await cosmic.objects.updateOne(user.id, updates);
  return appJson({ user: toAppUser(object) });
}

/** Deletes the member's account (required by the App Store and Google Play). */
export async function DELETE() {
  const user = await getAppUser();
  if (!user) return unauthorized();

  await cosmic.objects.deleteOne(user.id);
  return appJson({ status: 'deleted' });
}
