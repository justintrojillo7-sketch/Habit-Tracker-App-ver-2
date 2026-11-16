import { EventOccurrence } from '../types/lifehq';
import { formatDuration, minutesToTime, timeToMinutes } from './dateUtils';

export interface PositionedOccurrence {
  occ: EventOccurrence;
  startMin: number;
  endMin: number;
  col: number;
  colSpan: number;
  totalCols: number;
  leftPercent: number;
  widthPercent: number;
  maxVisualEndMin: number;
}

export interface AvailableWindowInfo {
  availableMinutes: number;
  untilTime: string;
  nextCommitment: EventOccurrence | null;
  summaryText: string;
}

/**
 * Identifies school timetable free / lesson-preparation blocks without mutating
 * underlying event data, so they can be styled distinctly and excluded from occupied time.
 */
export function isFreeSchoolPeriod(occ: EventOccurrence): boolean {
  if (!occ.isSchoolTimetable) return false;
  const titleLower = occ.title.toLowerCase();
  const notesLower = (occ.notes ?? '').toLowerCase();
  return (
    titleLower.includes('free period') ||
    notesLower.includes('available school time') ||
    occ.subcategory === 'Lesson planning'
  );
}

/**
 * Computes deduplicated occupied minutes for a collection of occurrences,
 * excluding free school periods, routine markers, and cancelled occurrences.
 */
export function calculateOccupiedMinutes(
  occurrences: EventOccurrence[]
): number {
  const byDate = new Map<string, Array<{ start: number; end: number }>>();

  for (const occ of occurrences) {
    if (occ.activityRecord?.status === 'cancelled') continue;
    if (occ.isRoutineMarker) continue;
    if (isFreeSchoolPeriod(occ)) continue;

    const start = Math.max(0, Math.min(1439, timeToMinutes(occ.startTime)));
    const end = Math.max(start, Math.min(1440, timeToMinutes(occ.endTime)));
    if (end <= start) continue;

    const list = byDate.get(occ.date) ?? [];
    list.push({ start, end });
    byDate.set(occ.date, list);
  }

  let total = 0;
  for (const intervals of byDate.values()) {
    intervals.sort((a, b) => a.start - b.start);
    let curStart = intervals[0].start;
    let curEnd = intervals[0].end;
    for (let i = 1; i < intervals.length; i++) {
      if (intervals[i].start <= curEnd) {
        curEnd = Math.max(curEnd, intervals[i].end);
      } else {
        total += curEnd - curStart;
        curStart = intervals[i].start;
        curEnd = intervals[i].end;
      }
    }
    total += curEnd - curStart;
  }
  return total;
}

/**
 * Sums duration of active free school periods (excluding cancelled ones).
 */
export function calculateFreeSchoolMinutes(
  occurrences: EventOccurrence[]
): number {
  let total = 0;
  for (const occ of occurrences) {
    if (occ.activityRecord?.status === 'cancelled') continue;
    if (!isFreeSchoolPeriod(occ)) continue;
    total += Math.max(0, occ.durationMinutes);
  }
  return total;
}

/**
 * Computes available time from `fromMinutes` until the next occupied commitment
 * on that day (ignoring cancelled events, free school periods, and tiny markers).
 */
export function getAvailableWindowFrom(
  dayOccurrences: EventOccurrence[],
  fromMinutes: number
): AvailableWindowInfo {
  const occupied = dayOccurrences
    .filter((occ) => {
      if (occ.activityRecord?.status === 'cancelled') return false;
      if (isFreeSchoolPeriod(occ)) return false;
      if (occ.isRoutineMarker && occ.durationMinutes <= 15) return false;
      return true;
    })
    .map((occ) => ({
      occ,
      startMin: timeToMinutes(occ.startTime),
      endMin: timeToMinutes(occ.endTime),
    }))
    .sort((a, b) => a.startMin - b.startMin);

  const next = occupied.find((item) => item.startMin > fromMinutes);
  if (next) {
    const availableMinutes = Math.max(0, next.startMin - fromMinutes);
    return {
      availableMinutes,
      untilTime: next.occ.startTime,
      nextCommitment: next.occ,
      summaryText: `${formatDuration(availableMinutes)} free until ${next.occ.title} (${next.occ.startTime})`,
    };
  }

  const availableMinutes = Math.max(0, 24 * 60 - fromMinutes);
  return {
    availableMinutes,
    untilTime: '24:00',
    nextCommitment: null,
    summaryText: `${formatDuration(availableMinutes)} free for rest of day`,
  };
}

/**
 * Partitions a single day's occurrences into connected overlapping clusters
 * and assigns side-by-side columns so overlapping events never obscure each other,
 * while back-to-back events (e.g. 10:20-10:35 and 10:35-11:00) stay full width
 * and never bleed into subsequent event labels.
 */
export function layoutDayEvents(
  occurrences: EventOccurrence[]
): PositionedOccurrence[] {
  if (occurrences.length === 0) return [];

  const items = occurrences
    .map((occ) => {
      const startMin = Math.max(0, Math.min(1439, timeToMinutes(occ.startTime)));
      const rawEnd = timeToMinutes(occ.endTime);
      const endMin = Math.max(startMin + 1, Math.min(1440, rawEnd));
      return { occ, startMin, endMin };
    })
    .sort((a, b) => {
      if (a.startMin !== b.startMin) return a.startMin - b.startMin;
      if (a.endMin !== b.endMin) return b.endMin - a.endMin;
      return a.occ.occurrenceKey.localeCompare(b.occ.occurrenceKey);
    });

  // Group into connected overlap clusters
  const clusters: Array<typeof items> = [];
  let currentCluster: typeof items = [];
  let clusterEnd = -1;

  for (const item of items) {
    if (currentCluster.length === 0 || item.startMin < clusterEnd) {
      currentCluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.endMin);
    } else {
      clusters.push(currentCluster);
      currentCluster = [item];
      clusterEnd = item.endMin;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const rawPlaced: PositionedOccurrence[] = [];

  for (const cluster of clusters) {
    const colEnds: number[] = [];
    const placed: Array<{
      occ: EventOccurrence;
      startMin: number;
      endMin: number;
      col: number;
    }> = [];

    for (const item of cluster) {
      let assignedCol = -1;
      for (let c = 0; c < colEnds.length; c++) {
        if (colEnds[c] <= item.startMin) {
          assignedCol = c;
          colEnds[c] = item.endMin;
          break;
        }
      }
      if (assignedCol === -1) {
        assignedCol = colEnds.length;
        colEnds.push(item.endMin);
      }
      placed.push({ ...item, col: assignedCol });
    }

    const totalCols = Math.max(1, colEnds.length);

    for (const item of placed) {
      let colSpan = 1;
      while (item.col + colSpan < totalCols) {
        const nextCol = item.col + colSpan;
        const collides = placed.some(
          (other) =>
            other !== item &&
            other.col === nextCol &&
            other.startMin < item.endMin &&
            other.endMin > item.startMin
        );
        if (collides) break;
        colSpan++;
      }

      const leftPercent = (item.col / totalCols) * 100;
      const widthPercent = (colSpan / totalCols) * 100;

      rawPlaced.push({
        occ: item.occ,
        startMin: item.startMin,
        endMin: item.endMin,
        col: item.col,
        colSpan,
        totalCols,
        leftPercent,
        widthPercent,
        maxVisualEndMin: 1440,
      });
    }
  }

  // Determine the earliest subsequent event start overlapping horizontally so short blocks
  // only expand into genuinely free space below them and never cover a later event.
  for (let i = 0; i < rawPlaced.length; i++) {
    const cur = rawPlaced[i];
    let ceiling = 1440;
    const curLeft = cur.leftPercent;
    const curRight = cur.leftPercent + cur.widthPercent;
    for (let j = 0; j < rawPlaced.length; j++) {
      if (i === j) continue;
      const other = rawPlaced[j];
      if (other.startMin < cur.endMin) continue;
      const otherLeft = other.leftPercent;
      const otherRight = other.leftPercent + other.widthPercent;
      const horizontallyOverlaps =
        otherLeft < curRight - 0.01 && otherRight > curLeft + 0.01;
      if (horizontallyOverlaps && other.startMin < ceiling) {
        ceiling = other.startMin;
      }
    }
    cur.maxVisualEndMin = ceiling;
  }

  return rawPlaced;
}

/**
 * Snaps a minute-of-day offset (from a pointer click on the time grid)
 * to a clean slot boundary and computes a valid default end time, optionally
 * capped to the available window before the next scheduled commitment.
 */
export function snapTimeSlotRange(
  rawMinutes: number,
  stepMinutes = 30,
  defaultDurationMinutes = 60,
  availableMinutes?: number
): { startTime: string; endTime: string } {
  const clamped = Math.max(0, Math.min(23 * 60 + 30, rawMinutes));
  const snappedStart = Math.floor(clamped / stepMinutes) * stepMinutes;
  const targetDuration =
    availableMinutes !== undefined && availableMinutes > 0 && availableMinutes < defaultDurationMinutes
      ? Math.max(15, availableMinutes)
      : defaultDurationMinutes;
  const clampedEnd = Math.min(23 * 60 + 59, snappedStart + targetDuration);
  return {
    startTime: minutesToTime(snappedStart),
    endTime: minutesToTime(Math.max(snappedStart + 10, clampedEnd)),
  };
}
