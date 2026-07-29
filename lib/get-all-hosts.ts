export async function getAllHosts() {
  const res = await import('../lib/cosmic-config');
  const response = await res.cosmic.objects
    .find({ type: 'regular-hosts' })
    .props('id,slug,title')
    .limit(500);
  return response.objects || [];
}
