import { ActivityRecord, AppState, CalendarEvent, EventOccurrence } from '../types/lifehq';
import { formatDisplayDate } from './dateUtils';

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function unescapeICS(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

export function exportOccurrencesToICS(occurrences: EventOccurrence[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LifeHQ//Personal Life OS//EN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:LifeHQ Export',
    'X-WR-TIMEZONE:Europe/London',
  ];

  for (const occ of occurrences) {
    if (occ.isRoutineMarker) continue;
    const dateCompact = occ.date.replace(/-/g, '');
    const st = occ.startTime.replace(':', '') + '00';
    const et = occ.endTime.replace(':', '') + '00';
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${occ.occurrenceKey}@lifehq.app`);
    lines.push(`DTSTART;TZID=Europe/London:${dateCompact}T${st}`);
    lines.push(`DTEND;TZID=Europe/London:${dateCompact}T${et}`);
    lines.push(`SUMMARY:${escapeICS(occ.title)}`);
    if (occ.location) lines.push(`LOCATION:${escapeICS(occ.location)}`);
    const descParts = [
      `Category: ${occ.category}`,
      `Status: ${occ.commitmentStatus}`,
      occ.linkedRoleBadge ? `Role: ${occ.linkedRoleBadge}` : '',
      occ.notes ?? '',
    ].filter(Boolean);
    lines.push(`DESCRIPTION:${escapeICS(descParts.join('\n'))}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function parseICSDateTime(raw: string): { date: string; time: string } | null {
  const value = raw.split(':').pop()?.trim() ?? '';
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!match) return null;
  const [, y, m, d, hh = '09', mm = '00'] = match;
  return {
    date: `${y}-${m}-${d}`,
    time: `${hh}:${mm}`,
  };
}

export function parseICSEvents(
  icsContent: string,
  existingEvents: CalendarEvent[]
): {
  imported: CalendarEvent[];
  skippedDuplicates: number;
} {
  const unfolded = icsContent.replace(/\r?\n[ \t]/g, '');
  const blocks = unfolded.split(/BEGIN:VEVENT/i).slice(1);

  const existingUids = new Set(
    existingEvents.map((e) => e.icsUid).filter(Boolean) as string[]
  );
  const existingSignatures = new Set(
    existingEvents.map(
      (e) => `${e.title.toLowerCase().trim()}|${e.startDate}|${e.startTime}`
    )
  );

  const imported: CalendarEvent[] = [];
  let skippedDuplicates = 0;

  for (const block of blocks) {
    const endIdx = block.search(/END:VEVENT/i);
    const body = endIdx >= 0 ? block.slice(0, endIdx) : block;
    const lines = body.split(/\r?\n/);

    let uid = '';
    let summary = '';
    let dtStartRaw = '';
    let dtEndRaw = '';
    let location = '';
    let description = '';

    for (const line of lines) {
      if (line.startsWith('UID:')) uid = line.slice(4).trim();
      else if (line.startsWith('SUMMARY'))
        summary = unescapeICS(line.slice(line.indexOf(':') + 1).trim());
      else if (line.startsWith('DTSTART')) dtStartRaw = line;
      else if (line.startsWith('DTEND')) dtEndRaw = line;
      else if (line.startsWith('LOCATION'))
        location = unescapeICS(line.slice(line.indexOf(':') + 1).trim());
      else if (line.startsWith('DESCRIPTION'))
        description = unescapeICS(line.slice(line.indexOf(':') + 1).trim());
    }

    const start = parseICSDateTime(dtStartRaw);
    if (!start || !summary) continue;
    const end = parseICSDateTime(dtEndRaw);
    const endTime =
      end && end.time > start.time
        ? end.time
        : start.time >= '23:00'
        ? '23:59'
        : `${String(Number(start.time.slice(0, 2)) + 1).padStart(2, '0')}:${start.time.slice(3, 5)}`;

    const sig = `${summary.toLowerCase().trim()}|${start.date}|${start.time}`;
    if ((uid && existingUids.has(uid)) || existingSignatures.has(sig)) {
      skippedDuplicates++;
      continue;
    }

    if (uid) existingUids.add(uid);
    existingSignatures.add(sig);

    imported.push({
      id: `ics-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: summary.slice(0, 200),
      category: 'personal',
      subcategory: 'Errands & admin',
      startDate: start.date,
      startTime: start.time,
      endTime,
      recurrence: 'once',
      commitmentStatus: 'confirmed',
      source: 'ics-import',
      location: location ? location.slice(0, 200) : undefined,
      notes: description
        ? `[ICS Import]\n${description}`.slice(0, 1000)
        : '[ICS Import]',
      icsUid: uid ? uid.slice(0, 256) : undefined,
    });
  }

  return { imported, skippedDuplicates };
}

export function exportLogsToCSV(records: ActivityRecord[]): string {
  const headers = [
    'Date',
    'Start Time',
    'End Time',
    'Title',
    'Category',
    'Subcategory',
    'Project',
    'Status',
    'Source',
    'Scheduled Minutes',
    'Actual Minutes',
    'Notes',
  ];

  const escapeCSV = (val: string | number | undefined) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = records.map((r) =>
    [
      r.date,
      r.startTime,
      r.endTime,
      r.title,
      r.category,
      r.subcategory,
      r.project ?? '',
      r.status,
      r.sourceType,
      r.scheduledMinutes ?? '',
      r.actualMinutes,
      r.notes ?? '',
    ]
      .map(escapeCSV)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function buildJSONBackup(state: AppState): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      exportedDisplay: formatDisplayDate(new Date().toISOString().slice(0, 10)),
      app: 'LifeHQ',
      ...state,
    },
    null,
    2
  );
}
