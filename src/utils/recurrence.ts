import {
  ActivityRecord,
  AppSettings,
  CalendarEvent,
  EventOccurrence,
} from '../types/lifehq';
import {
  addDays,
  diffDays,
  getIsoWeekday,
  getWeekType,
  isNthWeekdayOfMonth,
  isSchoolHoliday,
  isWednesdayBeforeThirdSunday,
  timeToMinutes,
} from './dateUtils';

function matchesRecurrenceOnDate(
  event: CalendarEvent,
  dateStr: string,
  settings: AppSettings
): boolean {
  if (dateStr < event.startDate) return false;
  if (event.endDate && dateStr > event.endDate) return false;

  if (event.isSchoolTimetable && isSchoolHoliday(dateStr, settings.schoolHolidays)) {
    return false;
  }

  if (event.weekAB && event.weekAB !== 'both') {
    const currentWeekType = getWeekType(dateStr, settings);
    if (currentWeekType !== event.weekAB) return false;
  }

  const isoDay = getIsoWeekday(dateStr);

  switch (event.recurrence) {
    case 'once':
      return dateStr === event.startDate;
    case 'daily':
      return true;
    case 'weekly': {
      const days = event.daysOfWeek?.length
        ? event.daysOfWeek
        : [getIsoWeekday(event.startDate)];
      return days.includes(isoDay);
    }
    case 'fortnightly': {
      const days = event.daysOfWeek?.length
        ? event.daysOfWeek
        : [getIsoWeekday(event.startDate)];
      if (!days.includes(isoDay)) return false;
      const daysSinceStart = diffDays(event.startDate, dateStr);
      const weeksSinceStart = Math.floor(daysSinceStart / 7);
      return weeksSinceStart % 2 === 0;
    }
    case 'monthly': {
      const targetDay = Number(event.startDate.split('-')[2]);
      const currentDay = Number(dateStr.split('-')[2]);
      return currentDay === targetDay;
    }
    case 'nthWeekday': {
      if (!event.nth || !event.weekday) return false;
      return isNthWeekdayOfMonth(dateStr, event.nth, event.weekday);
    }
    case 'wednesdayBeforeThirdSunday':
      return isWednesdayBeforeThirdSunday(dateStr);
    case 'custom': {
      const interval = Math.max(1, event.customIntervalDays ?? 7);
      const d = diffDays(event.startDate, dateStr);
      return d >= 0 && d % interval === 0;
    }
    default:
      return false;
  }
}

export function expandEventsForRange(
  events: CalendarEvent[],
  startDate: string,
  endDate: string,
  settings: AppSettings,
  activityRecords: ActivityRecord[]
): EventOccurrence[] {
  const occurrences: EventOccurrence[] = [];
  const recordLookup = new Map<string, ActivityRecord>();

  for (const rec of activityRecords) {
    if (rec.sourceType === 'scheduled' && rec.eventId && rec.occurrenceDate) {
      recordLookup.set(`${rec.eventId}_${rec.occurrenceDate}`, rec);
    }
  }

  let cursor = startDate;
  while (cursor <= endDate) {
    for (const event of events) {
      const exception = event.exceptions?.[cursor];

      // Check if an exception moved another occurrence INTO `cursor`
      if (event.exceptions) {
        for (const [origDate, exc] of Object.entries(event.exceptions)) {
          if (!exc.deleted && exc.date === cursor && origDate !== cursor) {
            const st = exc.startTime ?? event.startTime;
            const et = exc.endTime ?? event.endTime;
            const dur = Math.max(0, timeToMinutes(et) - timeToMinutes(st));
            const roleBadge =
              event.linkedMonthlyRole &&
              isNthWeekdayOfMonth(
                cursor,
                event.linkedMonthlyRole.nth,
                event.linkedMonthlyRole.weekday
              )
                ? event.linkedMonthlyRole.label
                : undefined;

            occurrences.push({
              occurrenceKey: `${event.id}_${origDate}`,
              eventId: event.id,
              date: cursor,
              originalDate: origDate,
              title: exc.title ?? event.title,
              category: exc.category ?? event.category,
              subcategory: exc.subcategory ?? event.subcategory,
              startTime: st,
              endTime: et,
              durationMinutes: dur,
              commitmentStatus: exc.commitmentStatus ?? event.commitmentStatus,
              source: event.source,
              isSchoolTimetable: event.isSchoolTimetable,
              isRoutineMarker: event.isRoutineMarker,
              isFlexible: event.isFlexible,
              durationUnconfirmed: event.durationUnconfirmed,
              location: exc.location ?? event.location,
              notes: exc.notes ?? event.notes,
              reminderMinutes: event.reminderMinutes,
              linkedHabitId: event.linkedHabitId,
              linkedRoleBadge: roleBadge,
              isOverridden: true,
              activityRecord: recordLookup.get(`${event.id}_${origDate}`),
            });
          }
        }
      }

      if (!matchesRecurrenceOnDate(event, cursor, settings)) continue;
      if (exception?.deleted) continue;
      if (exception?.date && exception.date !== cursor) continue;

      const startTime = exception?.startTime ?? event.startTime;
      const endTime = exception?.endTime ?? event.endTime;
      const durationMinutes = Math.max(
        0,
        timeToMinutes(endTime) - timeToMinutes(startTime)
      );

      const roleBadge =
        event.linkedMonthlyRole &&
        isNthWeekdayOfMonth(
          cursor,
          event.linkedMonthlyRole.nth,
          event.linkedMonthlyRole.weekday
        )
          ? event.linkedMonthlyRole.label
          : undefined;

      occurrences.push({
        occurrenceKey: `${event.id}_${cursor}`,
        eventId: event.id,
        date: cursor,
        originalDate: cursor,
        title: exception?.title ?? event.title,
        category: exception?.category ?? event.category,
        subcategory: exception?.subcategory ?? event.subcategory,
        startTime,
        endTime,
        durationMinutes,
        commitmentStatus: exception?.commitmentStatus ?? event.commitmentStatus,
        source: event.source,
        isSchoolTimetable: event.isSchoolTimetable,
        isRoutineMarker: event.isRoutineMarker,
        isFlexible: event.isFlexible,
        durationUnconfirmed: event.durationUnconfirmed,
        location: exception?.location ?? event.location,
        notes: exception?.notes ?? event.notes,
        reminderMinutes: event.reminderMinutes,
        linkedHabitId: event.linkedHabitId,
        linkedRoleBadge: roleBadge,
        isOverridden: Boolean(exception),
        activityRecord: recordLookup.get(`${event.id}_${cursor}`),
      });
    }
    cursor = addDays(cursor, 1);
  }

  return occurrences.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
  });
}
