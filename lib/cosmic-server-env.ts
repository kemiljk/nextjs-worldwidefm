/** Read Cosmic credentials only on the server, including the legacy env name. */
export function getCosmicReadKey(): string | undefined {
  if (typeof window !== 'undefined') {
    throw new Error('Cosmic credentials must not be used in browser code');
  }
  // Avoid static substitution of the legacy NEXT_PUBLIC_ variable if this
  // module is accidentally imported from a client component.
  const environment = process.env;
  return environment.COSMIC_READ_KEY || environment.NEXT_PUBLIC_COSMIC_READ_KEY;
}
