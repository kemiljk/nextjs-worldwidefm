import { appError, appJson, getAppUser, unauthorized } from '@/lib/app-api';
import {
  FAVOURITE_FIELDS,
  toAppUser,
  updateFavourites,
  type FavouriteKind,
} from '@/lib/member-account';

type Params = { params: Promise<{ kind: string; id: string }> };

async function change(action: 'add' | 'remove', { params }: Params) {
  const user = await getAppUser();
  if (!user) return unauthorized();

  const { kind, id } = await params;
  if (!(kind in FAVOURITE_FIELDS)) return appError('Unknown favourite type.', 404);
  if (!/^[A-Za-z0-9]{1,64}$/.test(id)) return appError('Invalid id.', 400);

  const updated = await updateFavourites(
    user.id,
    FAVOURITE_FIELDS[kind as FavouriteKind],
    [id],
    action
  );
  return appJson({ favourites: toAppUser(updated).favourites });
}

export const PUT = (_request: Request, context: Params) => change('add', context);
export const DELETE = (_request: Request, context: Params) => change('remove', context);
