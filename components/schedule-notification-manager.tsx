'use client';

import { useCallback, useEffect } from 'react';
import {
  createScheduleReminderKey,
  getReminderDate,
  parseScheduleReminders,
  SCHEDULE_NOTIFICATIONS_CHANGED_EVENT,
  SCHEDULE_NOTIFICATIONS_STORAGE_KEY,
} from '@/lib/schedule-reminders';
import type { ScheduleShow } from '@/lib/types/schedule';
import { getEpisodeReminderDelay } from '@/lib/episode-reminders';

export function ScheduleNotificationManager() {
  const scheduleNotifications = useCallback(() => {
    if (
      typeof Notification === 'undefined' ||
      Notification.permission !== 'granted' ||
      localStorage.getItem(SCHEDULE_NOTIFICATIONS_STORAGE_KEY) !== 'enabled'
    ) {
      return () => {};
    }

    const controller = new AbortController();
    const timers: number[] = [];

    fetch('/api/member/episode-reminders', { signal: controller.signal })
      .then(response => (response.ok ? response.json() : null))
      .then(data => {
        if (!data || !Array.isArray(data.reminders)) return;
        for (const reminder of data.reminders) {
          const startMs = Date.parse(reminder.startsAt);
          const delay = getEpisodeReminderDelay(startMs, Date.now());
          if (delay === null) continue;
          timers.push(
            window.setTimeout(() => {
              const key = `wwfm-episode-reminder-${data.userId}-${reminder.id}-${startMs}`;
              if (localStorage.getItem(key)) return;
              localStorage.setItem(key, 'sent');
              const minutes = Math.max(1, Math.ceil((startMs - Date.now()) / 60_000));
              if (startMs <= Date.now()) return;
              const notification = new Notification(`Worldwide FM: ${reminder.title}`, {
                body: `Starts in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`,
                icon: '/favicon.ico',
                tag: key,
              });
              notification.onclick = () => {
                window.focus();
                window.location.href = `/episode/${encodeURIComponent(reminder.slug)}`;
                notification.close();
              };
            }, delay)
          );
        }
      })
      .catch(error => {
        if (error instanceof Error && error.name !== 'AbortError')
          console.error('Unable to schedule show reminders:', error);
      });

    fetch('/api/member/schedule-reminders', { signal: controller.signal })
      .then(response => (response.ok ? response.json() : null))
      .then(data => {
        if (!data) return;
        const reminders = parseScheduleReminders(data.reminders);
        const reminderMap = new Map(reminders.map(reminder => [reminder.key, reminder]));

        for (const show of (data.scheduleItems || []) as ScheduleShow[]) {
          const preference = reminderMap.get(
            createScheduleReminderKey(show.name, show.show_day, show.show_time)
          );
          if (!preference) continue;

          const reminderDate = getReminderDate(show.date, show.show_time, preference.leadMinutes);
          if (!reminderDate) continue;
          const delay = reminderDate.getTime() - Date.now();
          if (delay <= 0 || delay > 2_147_483_647) continue;

          timers.push(
            window.setTimeout(() => {
              new Notification(`Worldwide FM: ${show.name}`, {
                body: `Starts in ${preference.leadMinutes} minutes.`,
                icon: show.picture || '/favicon.ico',
                tag: `wwfm-${show.event_id}`,
              });
            }, delay)
          );
        }
      })
      .catch(error => {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Unable to schedule programme reminders:', error);
        }
      });

    return () => {
      controller.abort();
      timers.forEach(timer => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    let cleanup = scheduleNotifications();
    const reschedule = () => {
      cleanup();
      cleanup = scheduleNotifications();
    };
    const interval = window.setInterval(reschedule, 5 * 60 * 1000);
    window.addEventListener(SCHEDULE_NOTIFICATIONS_CHANGED_EVENT, reschedule);
    window.addEventListener('focus', reschedule);
    return () => {
      cleanup();
      window.clearInterval(interval);
      window.removeEventListener(SCHEDULE_NOTIFICATIONS_CHANGED_EVENT, reschedule);
      window.removeEventListener('focus', reschedule);
    };
  }, [scheduleNotifications]);

  return null;
}
