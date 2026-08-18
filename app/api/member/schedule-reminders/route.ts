import { NextResponse } from 'next/server';
import { getAuthUser, getUserData } from '@/cosmic/blocks/user-management/actions';
import { getWeeklySchedule } from '@/lib/schedule-service';
import { parseScheduleReminders } from '@/lib/schedule-reminders';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [{ data }, schedule] = await Promise.all([getUserData(user.id), getWeeklySchedule()]);
  if (!data) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  return NextResponse.json({
    reminders: parseScheduleReminders(data.metadata?.schedule_reminders),
    scheduleItems: schedule.scheduleItems,
  });
}
