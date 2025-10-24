import { useState, useEffect } from 'react';
import {
  getRadioShows,
  getSchedule,
  transformShowToViewData,
  getRadioShowBySlug,
} from './cosmic-service';
import { ScheduleObject } from './cosmic-config';
import { addHours, isWithinInterval, isAfter } from 'date-fns';

export function useRadioShows(limit = 5) {
  const [shows, setShows] = useState<ReturnType<typeof transformShowToViewData>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchShows() {
      try {
        setLoading(true);
        const response = await getRadioShows({ limit });

        if (response.objects && response.objects.length > 0) {
          const transformedShows = response.objects.map(transformShowToViewData);
          setShows(transformedShows);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error fetching radio shows'));
      } finally {
        setLoading(false);
      }
    }

    fetchShows();
  }, [limit]);

  return { shows, loading, error };
}

export function useRadioShowBySlug(slug: string) {
  const [show, setShow] = useState<ReturnType<typeof transformShowToViewData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchShow() {
      if (!slug) return;

      try {
        setLoading(true);
        const response = await getRadioShowBySlug(slug);

        if (response.objects && response.objects.length > 0) {
          setShow(transformShowToViewData(response.objects[0]));
        }
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error(`Unknown error fetching radio show: ${slug}`)
        );
      } finally {
        setLoading(false);
      }
    }

    fetchShow();
  }, [slug]);

  return { show, loading, error };
}

export function useSchedule(slug = 'main-schedule') {
  const [schedule, setSchedule] = useState<ScheduleObject | null>(null);
  const [currentShow, setCurrentShow] = useState<ReturnType<typeof transformShowToViewData> | null>(
    null
  );
  const [upcomingShow, setUpcomingShow] = useState<ReturnType<
    typeof transformShowToViewData
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchSchedule() {
      try {
        setLoading(true);
        const response = await getSchedule();

        if (response?.object) {
          setSchedule({
            slug: response.object.slug,
            title: response.object.title,
            type: 'schedule',
            metadata: {
              shows: [],
              scheduled_shows: [],
              is_active: response.object.metadata.is_active === 'true',
              special_scheduling_options: {
                override_normal_schedule: false,
                override_reason: null,
                special_insertions: [],
              },
              schedule_notes: null,
            },
          });
        } else {
          // If no schedule, get shows based on broadcast dates
          const showsResponse = await getRadioShows({
            limit: 7,
            sort: '-metadata.broadcast_date',
            status: 'published',
          });

          if (showsResponse.objects && showsResponse.objects.length > 0) {
            const now = new Date();
            const allShows = showsResponse.objects
              .filter(show => show.metadata?.broadcast_date)
              .sort((a, b) => {
                const dateA = new Date(a.metadata.broadcast_date || '');
                const dateB = new Date(b.metadata.broadcast_date || '');
                if (isNaN(dateA.getTime())) return 1;
                if (isNaN(dateB.getTime())) return -1;
                return dateB.getTime() - dateA.getTime();
              });

            if (allShows.length > 0) {
              // Find current show (within last 2 hours)
              const currentShowObj = allShows.find(show => {
                const startTime = new Date(show.metadata.broadcast_date || '');
                const endTime = addHours(startTime, 2);
                return isWithinInterval(now, { start: startTime, end: endTime });
              });

              if (currentShowObj) {
                setCurrentShow(transformShowToViewData(currentShowObj));
              }

              // Get upcoming shows (future shows)
              const upcomingShowsList = allShows
                .filter(show => {
                  const startTime = new Date(show.metadata.broadcast_date || '');
                  return (
                    isAfter(startTime, now) && (!currentShowObj || show.id !== currentShowObj.id)
                  );
                })
                .sort((a, b) => {
                  const dateA = new Date(a.metadata.broadcast_date || '');
                  const dateB = new Date(b.metadata.broadcast_date || '');
                  return dateA.getTime() - dateB.getTime();
                });

              if (upcomingShowsList.length > 0) {
                setUpcomingShow(transformShowToViewData(upcomingShowsList[0]));
              }
            }
          }
        }
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error(`Unknown error fetching schedule: ${slug}`)
        );
      } finally {
        setLoading(false);
      }
    }

    fetchSchedule();
  }, [slug]);

  return { schedule, currentShow, upcomingShow, loading, error };
}
