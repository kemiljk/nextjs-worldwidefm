'use server';

import { getCosmicHosts } from '@/lib/cosmic-host-service';
import { getCosmicLocations } from '@/lib/cosmic-location-service';
import { getCosmicTakeovers } from '@/lib/cosmic-takeover-service';

export async function fetchFormHosts() {
  return getCosmicHosts();
}

export async function fetchFormLocations() {
  return getCosmicLocations();
}

export async function fetchFormTakeovers() {
  return getCosmicTakeovers();
}
