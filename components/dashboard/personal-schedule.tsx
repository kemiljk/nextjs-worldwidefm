'use client';

import { Bell, BellOff, CalendarDays, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { setScheduleReminder } from '@/cosmic/blocks/user-management/actions';
import { useAuth } from '@/cosmic/blocks/user-management/AuthContext';
import {
  createScheduleReminderKey,
  createScheduleReminderPreference,
  DEFAULT_REMINDER_LEAD_MINUTES,
  SCHEDULE_NOTIFICATIONS_CHANGED_EVENT,
  SCHEDULE_NOTIFICATIONS_STORAGE_KEY,
  type ScheduleReminderPreference,
} from '@/lib/schedule-reminders';
import type { ScheduleShow } from '@/lib/types/schedule';

interface PersonalScheduleProps {
  reminders: ScheduleReminderPreference[];
  scheduleItems: ScheduleShow[];
}

export function PersonalSchedule({ reminders, scheduleItems }: PersonalScheduleProps) {
  const { user } = useAuth();
  const [savedReminders, setSavedReminders] = useState(reminders);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isPending, startTransition] = useTransition();

  const reminderMap = useMemo(
    () => new Map(savedReminders.map(reminder => [reminder.key, reminder])),
    [savedReminders]
  );
  const upcoming = useMemo(() => {
    return scheduleItems
      .filter(show =>
        reminderMap.has(createScheduleReminderKey(show.name, show.show_day, show.show_time))
      )
      .sort((a, b) => `${a.date}T${a.show_time}`.localeCompare(`${b.date}T${b.show_time}`));
  }, [reminderMap, scheduleItems]);

  useEffect(() => {
    setNotificationsEnabled(
      typeof Notification !== 'undefined' &&
        Notification.permission === 'granted' &&
        localStorage.getItem(SCHEDULE_NOTIFICATIONS_STORAGE_KEY) === 'enabled'
    );
  }, []);

  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    const permission = await Notification.requestPermission();
    const enabled = permission === 'granted';
    localStorage.setItem(SCHEDULE_NOTIFICATIONS_STORAGE_KEY, enabled ? 'enabled' : 'disabled');
    setNotificationsEnabled(enabled);
    window.dispatchEvent(new Event(SCHEDULE_NOTIFICATIONS_CHANGED_EVENT));
  };

  const disableNotifications = () => {
    localStorage.setItem(SCHEDULE_NOTIFICATIONS_STORAGE_KEY, 'disabled');
    setNotificationsEnabled(false);
    window.dispatchEvent(new Event(SCHEDULE_NOTIFICATIONS_CHANGED_EVENT));
  };

  const remove = (show: ScheduleShow) => {
    if (!user) return;
    startTransition(async () => {
      const { key, ...preference } = createScheduleReminderPreference(show);
      const result = await setScheduleReminder(preference, false);
      if (result.success) {
        setSavedReminders(current => current.filter(reminder => reminder.key !== key));
        window.dispatchEvent(new Event(SCHEDULE_NOTIFICATIONS_CHANGED_EVENT));
      }
    });
  };

  return (
    <section className='mt-10'>
      <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-2xl font-bold uppercase font-mono tracking-tight'>
            My Weekly Schedule
          </h2>
          <p className='mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-400'>
            Save programmes from the schedule and get a browser reminder{' '}
            {DEFAULT_REMINDER_LEAD_MINUTES} minutes before they start. Keep Worldwide FM open in a
            browser tab for reminders to fire.
          </p>
        </div>
        {notificationsEnabled ? (
          <button
            type='button'
            onClick={disableNotifications}
            className='inline-flex min-h-11 items-center gap-2 border border-almostblack px-4 font-mono text-xs uppercase dark:border-white'
          >
            <BellOff className='size-4' /> Disable reminders
          </button>
        ) : (
          <button
            type='button'
            onClick={enableNotifications}
            className='inline-flex min-h-11 items-center gap-2 bg-almostblack px-4 font-mono text-xs uppercase text-white dark:bg-white dark:text-black'
          >
            <Bell className='size-4' /> Enable reminders
          </button>
        )}
      </div>

      {upcoming.length === 0 ? (
        <div className='border border-almostblack p-6 dark:border-white'>
          <CalendarDays className='mb-3 size-6' />
          <p className='font-mono uppercase'>No programmes saved this week.</p>
          <Link href='/schedule' className='mt-3 inline-block underline underline-offset-4'>
            Build your schedule
          </Link>
        </div>
      ) : (
        <div className='divide-y divide-gray-300 border-y border-almostblack dark:divide-gray-700 dark:border-white'>
          {upcoming.map(show => (
            <div key={show.event_id} className='flex items-center gap-4 py-4'>
              <time className='w-28 shrink-0 font-mono text-xs uppercase'>
                {show.show_day.slice(0, 3)} {show.show_time}
              </time>
              <Link href={show.url || '/schedule'} className='min-w-0 flex-1 font-mono uppercase'>
                {show.name}
              </Link>
              <button
                type='button'
                onClick={() => remove(show)}
                disabled={isPending}
                aria-label={`Remove ${show.name} from my schedule`}
                className='inline-flex min-h-11 min-w-11 items-center justify-center border border-almostblack disabled:opacity-50 dark:border-white'
              >
                <X className='size-4' />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
