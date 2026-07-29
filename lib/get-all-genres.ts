export async function getAllGenres() {
  const res = await import('../lib/cosmic-config');
  const response = await res.cosmic.objects
    .find({ type: 'genres' })
    .props('id,slug,title')
    .limit(500);
  return response.objects || [];
}
