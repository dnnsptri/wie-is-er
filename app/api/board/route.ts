import { attendanceKey, calendar, canSelect, dateAtUtc, people, scheduleFor, workdays } from '@/lib/board';
import { readBoard, updateBoard } from '@/lib/store';

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET() {
  try {
    return json(await readBoard());
  } catch (error) {
    console.error('Reading attendance failed', error);
    return json({ error: 'Het bord is tijdelijk niet beschikbaar.' }, 503);
  }
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const url = new URL(request.url);
  const host = request.headers.get('host') ?? url.host;
  if (origin && origin !== url.origin && origin !== `${url.protocol}//${host}`) {
    return json({ error: 'Open het bord om je aanwezigheid aan te passen.' }, 403);
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return json({ error: 'Ongeldige wijziging.' }, 415);
  }

  const raw = await request.text();
  if (raw.length > 512) return json({ error: 'Ongeldige wijziging.' }, 413);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'Ongeldige wijziging.' }, 400);
  }

  const person = people.find(({ id }) => id === body?.person);
  if (!person) return json({ error: 'Onbekende persoonlijke link.' }, 400);

  const now = new Date();
  const office = calendar(now);
  try {
    if (body.type === 'attendance') {
      const { date, present } = body;
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)
        || typeof present !== 'boolean' || !canSelect(date, office)) {
        return json({ error: 'Deze datum is niet beschikbaar.' }, 400);
      }
      const key = attendanceKey(person.id, date);
      return json(await updateBoard((data) => {
        const schedule = scheduleFor(data, person, date);
        const regular = schedule?.includes(dateAtUtc(date).getUTCDay());
        if (regular === present) {
          delete data.attendance[key];
        } else if (data.attendance[key]?.present !== present) {
          data.attendance[key] = { present, savedAt: now.getTime() };
        }
      }));
    }

    if (body.type === 'schedule') {
      if (!Array.isArray(body.days) || body.days.length > workdays.length
        || !body.days.every((value: unknown) => workdays.some((day) => day.number === value))) {
        return json({ error: 'Kies je vaste werkdagen.' }, 400);
      }
      const days = [...new Set<number>(body.days)].sort((a, b) => a - b);
      return json(await updateBoard((data) => {
        const history = data.schedules[person.id] ?? [];
        data.schedules[person.id] = [
          ...history.filter(({ from }) => from < office.today),
          { from: office.today, days },
        ];
      }));
    }
  } catch (error) {
    console.error('Saving attendance failed', error);
    return json({ error: 'Opslaan is niet gelukt. Probeer het opnieuw.' }, 503);
  }

  return json({ error: 'Ongeldige wijziging.' }, 400);
}
