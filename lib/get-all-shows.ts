export async function getAllShows() {
  const res = await import('../lib/cosmic-config');
  return (
    (
      await res.cosmic.objects
        .find({ type: 'episode', status: 'published' })
        .sort('-metadata.broadcast_date')
    ).objects || []
  );
}
