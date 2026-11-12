type Genre = { id: string; title: string };
type Episode = {
  id?: string;
  slug?: string;
  metadata?: { genres?: Array<string | { id?: string }> };
};

/** Select a different matching episode per genre when the shared pool permits it. */
export function selectHomepageGenreEpisodes<T extends Episode>(genres: Genre[], episodes: T[]) {
  const selected: Record<string, T> = {};
  const used = new Set<string>();
  for (const genre of genres) {
    const matching = episodes.filter(episode =>
      episode.metadata?.genres?.some(
        item => (typeof item === 'string' ? item : item.id) === genre.id
      )
    );
    const episode = matching.find(item => !used.has(item.id || item.slug || '')) || matching[0];
    if (episode) {
      selected[genre.title] = episode;
      used.add(episode.id || episode.slug || '');
    }
  }
  return selected;
}
