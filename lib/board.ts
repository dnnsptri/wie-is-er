export const people = [
  { id: 'stef', name: 'Stef', days: [2, 3, 4] },
  { id: 'martijn', name: 'Martijn', days: [1, 3, 5] },
  { id: 'sylvia', name: 'Sylvia', days: null },
  { id: 'jenneke', name: 'Jenneke', days: [2, 4] },
  { id: 'dennis', name: 'Dennis', days: [1, 5] },
  { id: 'gianne', name: 'GIanne', days: null },
  { id: 'menno', name: 'Menno', days: [1, 2, 3, 4] },
  { id: 'lammert', name: 'Lammert', days: [1, 2, 3, 4] },
  { id: 'susi', name: 'Susi', days: [2, 3, 5] },
] as const;

export type Person = (typeof people)[number];
export type PersonId = Person['id'];

type RegularSchedule = { days: readonly number[]; alternateMonday?: string };
type Schedule = RegularSchedule & { from: string };
type Attendance = { present: boolean; savedAt: number };
export type BoardData = {
  schedules: Partial<Record<PersonId, Schedule[]>>;
  attendance: Record<string, Attendance | undefined>;
};

export const deskCount = 6;
export const workdays = [
  { number: 1, short: 'Ma', name: 'Maandag' },
  { number: 2, short: 'Di', name: 'Dinsdag' },
  { number: 3, short: 'Wo', name: 'Woensdag' },
  { number: 4, short: 'Do', name: 'Donderdag' },
  { number: 5, short: 'Vr', name: 'Vrijdag' },
];

const officeClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Amsterdam',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});

export const fullDate = new Intl.DateTimeFormat('nl-NL', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export function dateAtUtc(date: string) {
  return new Date(`${date}T12:00:00Z`);
}

export function addDays(date: string, days: number) {
  const result = dateAtUtc(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export function calendar(now = new Date()) {
  const parts = Object.fromEntries(officeClock.formatToParts(now).map(({ type, value }) => [type, value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const boardDate = Number(parts.hour) >= 19 ? addDays(today, 1) : today;
  const days: Array<(typeof workdays)[number] & { date: string }> = [];
  for (let offset = 0; days.length < workdays.length; offset += 1) {
    const date = addDays(boardDate, offset);
    const weekday = workdays[dateAtUtc(date).getUTCDay() - 1];
    if (weekday) days.push({ ...weekday, date });
  }
  return { today, boardDate, days };
}

export function canSelect(date: string, office: ReturnType<typeof calendar>) {
  return date === office.boardDate || office.days.some((day) => day.date === date);
}

export function scheduleFor(data: BoardData, person: Person, date: string): RegularSchedule | null {
  const version = data.schedules[person.id]?.findLast((schedule) => schedule.from <= date);
  return version ?? (person.days ? { days: person.days } : null);
}

export function regularAttendance(schedule: RegularSchedule | null, date: string): boolean | null {
  if (!schedule) return null;
  const officeDate = dateAtUtc(date);
  const weekday = officeDate.getUTCDay();
  if (schedule.days.includes(weekday)) return true;

  const firstMonday = schedule.alternateMonday;
  return weekday === 1 && Boolean(firstMonday && date >= firstMonday
    && (officeDate.getTime() - dateAtUtc(firstMonday).getTime()) % (14 * 86_400_000) === 0);
}

export function attendanceKey(person: PersonId, date: string) {
  return `${date}:${person}`;
}

export function rosterFor(data: BoardData, date: string) {
  const roster = people.map((person) => {
    const schedule = scheduleFor(data, person, date);
    const regular = regularAttendance(schedule, date);
    const entry = data.attendance[attendanceKey(person.id, date)];
    return {
      person,
      present: entry?.present ?? regular ?? false,
      unknown: !entry && schedule === null,
      extraAt: entry?.present && !regular ? entry.savedAt : null,
      ghost: false,
    };
  });

  const present = roster.filter((entry) => entry.present);
  const extras = present.filter((entry) => entry.extraAt !== null);
  extras.sort((a, b) => a.extraAt! - b.extraAt!);
  const desksLeftForExtras = Math.max(0, deskCount - (present.length - extras.length));
  for (const entry of extras.slice(desksLeftForExtras)) {
    entry.ghost = true;
  }
  return roster;
}
