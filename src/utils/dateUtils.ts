import { AppSettings, HolidayRange, WeekType } from '../types/lifehq';

const LONDON_TZ = 'Europe/London';

export function getLondonNow(): { date: string; time: string; minutes: number } {
  const now = new Date();
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: LONDON_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (parts: Intl.DateTimeFormatPart[], type: string) =>
    parts.find((p) => p.type === type)?.value ?? '00';

  const date = `${get(dateParts, 'year')}-${get(dateParts, 'month')}-${get(dateParts, 'day')}`;
  const hour = get(timeParts, 'hour') === '24' ? '00' : get(timeParts, 'hour');
  const minute = get(timeParts, 'minute');
  const time = `${hour}:${minute}`;
  return { date, time, minutes: timeToMinutes(time) };
}

export function parseDateUTCNoon(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function formatUTCNoonToDateStr(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDateUTCNoon(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return formatUTCNoonToDateStr(d);
}

export function diffDays(fromDate: string, toDate: string): number {
  const a = parseDateUTCNoon(fromDate).getTime();
  const b = parseDateUTCNoon(toDate).getTime();
  return Math.round((b - a) / 86400000);
}

export function getIsoWeekday(dateStr: string): number {
  const day = parseDateUTCNoon(dateStr).getUTCDay();
  return day === 0 ? 7 : day;
}

export function getMondayOfWeek(dateStr: string): string {
  const iso = getIsoWeekday(dateStr);
  return addDays(dateStr, -(iso - 1));
}

export function getSundayOfWeek(dateStr: string): string {
  return addDays(getMondayOfWeek(dateStr), 6);
}

export function getWeekDates(mondayStr: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayStr, i));
}

export function getMonthGridDates(year: number, monthIndex0: number): string[] {
  const firstOfMonth = formatUTCNoonToDateStr(
    new Date(Date.UTC(year, monthIndex0, 1, 12, 0, 0))
  );
  const startGrid = getMondayOfWeek(firstOfMonth);
  return Array.from({ length: 42 }, (_, i) => addDays(startGrid, i));
}

export function getWeekType(dateStr: string, settings: AppSettings): WeekType {
  const monday = getMondayOfWeek(dateStr);
  if (settings.weekOverrides && settings.weekOverrides[monday]) {
    return settings.weekOverrides[monday];
  }
  const anchorMonday = getMondayOfWeek(settings.weekAnchorMonday);
  const diffWeeks = Math.round(diffDays(anchorMonday, monday) / 7);
  const isSameParity = ((diffWeeks % 2) + 2) % 2 === 0;
  if (isSameParity) return settings.weekAnchorType;
  return settings.weekAnchorType === 'A' ? 'B' : 'A';
}

export function isSchoolHoliday(
  dateStr: string,
  holidays: HolidayRange[]
): HolidayRange | undefined {
  return holidays.find((h) => dateStr >= h.startDate && dateStr <= h.endDate);
}

export function isNthWeekdayOfMonth(
  dateStr: string,
  nth: number,
  isoWeekday: number
): boolean {
  if (getIsoWeekday(dateStr) !== isoWeekday) return false;
  const dayOfMonth = Number(dateStr.split('-')[2]);
  const occurrenceIndex = Math.floor((dayOfMonth - 1) / 7) + 1;
  return occurrenceIndex === nth;
}

export function getThirdSundayOfMonth(year: number, month1To12: number): string {
  const firstStr = `${year}-${String(month1To12).padStart(2, '0')}-01`;
  const firstIso = getIsoWeekday(firstStr);
  const offsetToFirstSunday = (7 - firstIso) % 7;
  const firstSundayDay = 1 + offsetToFirstSunday;
  const thirdSundayDay = firstSundayDay + 14;
  return `${year}-${String(month1To12).padStart(2, '0')}-${String(thirdSundayDay).padStart(2, '0')}`;
}

export function isWednesdayBeforeThirdSunday(dateStr: string): boolean {
  if (getIsoWeekday(dateStr) !== 3) return false;
  const [y, m] = dateStr.split('-').map(Number);
  const thirdSunday = getThirdSundayOfMonth(y, m);
  const targetWednesday = addDays(thirdSunday, -4);
  return dateStr === targetWednesday;
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function minutesToTime(totalMinutes: number): string {
  const clamped = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatDisplayDate(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }
): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    ...options,
  }).format(parseDateUTCNoon(dateStr));
}

export function formatShortDate(dateStr: string): string {
  return formatDisplayDate(dateStr, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function formatDuration(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatHoursDecimal(minutes: number): string {
  return `${(minutes / 60).toFixed(1)}h`;
}

export function formatStopwatch(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function getGreeting(minutesOfDay: number): string {
  if (minutesOfDay < 12 * 60) return 'Good morning';
  if (minutesOfDay < 17 * 60) return 'Good afternoon';
  return 'Good evening';
}

export interface TimeInterval {
  id: string;
  date: string;
  title: string;
  startMin: number;
  endMin: number;
  category: string;
}

export interface OverlapConflict {
  date: string;
  firstId: string;
  secondId: string;
  firstTitle: string;
  secondTitle: string;
  overlapMinutes: number;
}

export function analyseDayIntervals(intervals: TimeInterval[]): {
  mergedMinutes: number;
  conflicts: OverlapConflict[];
} {
  if (intervals.length === 0) return { mergedMinutes: 0, conflicts: [] };
  const valid = intervals
    .filter((i) => i.endMin > i.startMin)
    .sort((a, b) => a.startMin - b.startMin);

  if (valid.length === 0) return { mergedMinutes: 0, conflicts: [] };

  const conflicts: OverlapConflict[] = [];
  const merged: Array<{ id: string; start: number; end: number; title: string }> = [
    { id: valid[0].id, start: valid[0].startMin, end: valid[0].endMin, title: valid[0].title },
  ];

  for (let i = 1; i < valid.length; i++) {
    const curr = valid[i];
    const last = merged[merged.length - 1];
    if (curr.startMin < last.end) {
      const overlapMinutes = Math.min(last.end, curr.endMin) - curr.startMin;
      conflicts.push({
        date: curr.date,
        firstId: last.id,
        secondId: curr.id,
        firstTitle: last.title,
        secondTitle: curr.title,
        overlapMinutes,
      });
      if (curr.endMin > last.end) {
        last.end = curr.endMin;
        last.title = `${last.title} / ${curr.title}`;
      }
    } else {
      merged.push({ id: curr.id, start: curr.startMin, end: curr.endMin, title: curr.title });
    }
  }

  const mergedMinutes = merged.reduce((acc, m) => acc + (m.end - m.start), 0);
  return { mergedMinutes, conflicts };
}
