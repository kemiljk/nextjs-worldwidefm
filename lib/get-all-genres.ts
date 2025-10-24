export async function getAllGenres() {
  const res = await import('../lib/cosmic-config');
  return (await res.cosmic.objects.find({ type: 'genres' })).objects || [];
}
