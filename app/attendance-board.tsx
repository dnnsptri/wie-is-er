'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addDays, attendanceKey, calendar, canSelect, dateAtUtc, deskCount, fullDate, people, rosterFor,
  scheduleFor, workdays,
  type BoardData, type PersonId,
} from '@/lib/board';

type Change =
  | { type: 'attendance'; person: PersonId; date: string; present: boolean }
  | { type: 'schedule'; person: PersonId; days: number[] };

const emptyBoard: BoardData = { schedules: {}, attendance: {} };
const weekdayName = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', timeZone: 'UTC' });

export default function AttendanceBoard({
  initialCalendar,
  initialData,
}: {
  initialCalendar: ReturnType<typeof calendar>;
  initialData: BoardData | null;
}) {
  const [office, setOffice] = useState(initialCalendar);
  const [selection, setSelection] = useState<string | null>(null);
  const [data, setData] = useState(initialData);
  const [personId, setPersonId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [scheduleDays, setScheduleDays] = useState<number[]>([]);
  const [scheduleError, setScheduleError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const revision = useRef(0);
  const writing = useRef(false);

  const refresh = useCallback(async () => {
    if (writing.current) return;
    const request = ++revision.current;
    try {
      const response = await fetch('/api/board', { cache: 'no-store' });
      if (!response.ok) return;
      const updated: BoardData = await response.json();
      if (revision.current === request) setData(updated);
    } catch {
      // Preserve the last successful read during a connection interruption.
    }
  }, []);

  useEffect(() => {
    const readLink = () => setPersonId(location.hash.slice(1).toLowerCase());
    const updateClock = () => {
      const current = calendar();
      setOffice((previous) => (
        previous.today === current.today
          ? previous
          : current
      ));
    };
    const onFocus = () => {
      if (document.hidden) return;
      updateClock();
      void refresh();
    };
    readLink();
    updateClock();
    if (!initialData) void refresh();
    const timer = window.setInterval(updateClock, 15_000);
    window.addEventListener('hashchange', readLink);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('hashchange', readLink);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [initialData, refresh]);

  const date = selection && canSelect(selection, office) ? selection : office.today;
  const isToday = date === office.today;
  const dayWord = isToday ? 'vandaag' : date === addDays(office.today, 1)
    ? 'morgen' : weekdayName.format(dateAtUtc(date));
  const todayIsWeekend = office.days[0].date !== office.today;
  const dateLabel = fullDate.format(dateAtUtc(date));
  const roster = rosterFor(data ?? emptyBoard, date);
  const expected = roster.filter(({ present }) => present).length;
  const provisional = roster.some(({ unknown }) => unknown);
  const free = Math.max(0, deskCount - expected);
  const selected = roster.find(({ person }) => person.id === personId);
  const attendanceLabel = selected?.present ? 'Ik ben er niet' : 'Ik ben er';

  function selectDate(nextDate: string) {
    setSelection(nextDate === office.today ? null : nextDate);
    setError('');
    setNotice('');
    void refresh();
  }

  async function save(change: Change) {
    if (writing.current) return;
    writing.current = true;
    revision.current += 1;
    setSaving(true);
    setError('');
    setScheduleError('');
    setNotice('');
    const beforeSave = data;
    if (change.type === 'attendance' && beforeSave) {
      const key = attendanceKey(change.person, change.date);
      setData({
        ...beforeSave,
        attendance: {
          ...beforeSave.attendance,
          [key]: { present: change.present, savedAt: Date.now() },
        },
      });
    }
    try {
      const response = await fetch('/api/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(change),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Opslaan is niet gelukt.');
      setData(result);
      if (change.type === 'schedule') {
        dialog.current?.close();
        setNotice('Je vaste dagen zijn opgeslagen.');
      } else {
        const status = rosterFor(result, change.date).find(({ person }) => person.id === change.person);
        setNotice(status?.ghost
          ? 'Je komt. Alle zes de bureaus zijn al meegerekend.'
          : 'Je aanwezigheid is aangepast.');
      }
    } catch (failure) {
      const message = failure instanceof Error && failure.name === 'Error'
        ? failure.message
        : 'Opslaan is niet gelukt. Probeer het opnieuw.';
      if (change.type === 'schedule') {
        setScheduleError(message);
      } else {
        setData(beforeSave);
        setError(message);
      }
    } finally {
      writing.current = false;
      setSaving(false);
    }
  }

  function toggleAttendance() {
    if (!selected || !data) return;
    void save({ type: 'attendance', person: selected.person.id, date, present: !selected.present });
  }

  function openSchedule() {
    if (!selected || !data) return;
    setScheduleDays([...(scheduleFor(data, selected.person, office.today) ?? [])]);
    setScheduleError('');
    dialog.current?.showModal();
  }

  return (
    <main className="board-shell">
      <h1>Wie is er {dayWord}?</h1>

      <section className="availability"
        aria-label={data && provisional ? 'Voorlopige beschikbaarheid' : 'Beschikbaarheid'}
        aria-live="polite">
        {data ? (
          <strong>{free === 1 ? '1 plek vrij' : `${free} plekken vrij`}</strong>
        ) : (
          <>
            <strong>Bord niet beschikbaar</strong>
            <button className="text-button" onClick={() => void refresh()}>Opnieuw laden</button>
          </>
        )}
      </section>

      <ul className="portraits" aria-label={`Verwacht op ${dateLabel}`}>
        {roster.map(({ person, present, ghost, unknown: unconfirmed }) => {
          const status = !data || unconfirmed
            ? 'aanwezigheid onbekend'
            : ghost ? 'verwacht, alle bureaus meegerekend' : present ? 'verwacht' : 'afwezig';
          return (
            <li key={person.id} className={`card${present && data ? ' upright' : ''}${ghost ? ' ghost' : ''}`}
              aria-label={`${person.name}, ${status}`}>
              <div className="face" aria-hidden="true">
                {/* Fixed size crops preserve the original illustrated faces. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/portraits/${person.id}.webp`} alt="" width={360} height={360} />
              </div>
              <div className="fold" aria-hidden="true" />
              <div className="hinge" aria-hidden="true" />
              <span className="name">
                {person.name}
                {ghost && <span className="card-marker" aria-hidden="true">+1</span>}
                {data && unconfirmed && <span className="card-marker" aria-hidden="true">?</span>}
              </span>
              {person.id === selected?.person.id && (
                <button type="button" className="card-toggle" disabled={saving || !data}
                  aria-label={`${person.name}, ${attendanceLabel}`} onClick={toggleAttendance} />
              )}
            </li>
          );
        })}
      </ul>

      <section className="controls" aria-label="Kies een dag en pas je aanwezigheid aan">
        {todayIsWeekend && !isToday && (
          <div className="week-switch">
            <button className="text-button" onClick={() => selectDate(office.today)}>Terug naar vandaag</button>
          </div>
        )}
        <div className="weekdays" role="group" aria-label="Komende werkdagen">
          {office.days.map(({ date: iso, short }) => {
            const dayDate = dateAtUtc(iso);
            return (
              <button key={iso} type="button" className="weekday" aria-label={fullDate.format(dayDate)}
                aria-pressed={date === iso} onClick={() => selectDate(iso)}>
                {short} {dayDate.getUTCDate()}
              </button>
            );
          })}
        </div>

        {selected ? (
          <button className="attendance-button" disabled={saving || !data} aria-busy={saving} onClick={toggleAttendance}>
            {attendanceLabel}
          </button>
        ) : (
          <p className="personal-prompt">Open je persoonlijke link om je aanwezigheid aan te passen.</p>
        )}
        {error && <p className="feedback error" role="alert">{error}</p>}
        <p className="visually-hidden" role="status">{notice}</p>
      </section>

      {selected && (
        <footer>
          <span>{selected.person.name} · </span>
          <button type="button" className="text-button" onClick={openSchedule} disabled={saving || !data}>
            Vaste dagen aanpassen
          </button>
        </footer>
      )}

      <dialog ref={dialog} aria-labelledby="schedule-title"
        onCancel={(event) => { if (saving) event.preventDefault(); }}>
        <form onSubmit={(event) => {
          event.preventDefault();
          if (selected) void save({ type: 'schedule', person: selected.person.id, days: scheduleDays });
        }}>
          <h2 id="schedule-title">Vaste dagen</h2>
          <p>Op welke werkdagen is {selected?.person.name} meestal op kantoor?</p>
          <fieldset disabled={saving}>
            <legend className="visually-hidden">Vaste werkdagen</legend>
            {workdays.map((day) => (
              <label key={day.number}>
                <input type="checkbox" checked={scheduleDays.includes(day.number)}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;
                    setScheduleDays((previous) => checked
                      ? [...previous, day.number]
                      : previous.filter((number) => number !== day.number));
                  }} />
                {day.name}
              </label>
            ))}
          </fieldset>
          {scheduleError && <p className="error" role="alert">{scheduleError}</p>}
          <div className="dialog-actions">
            <button type="button" disabled={saving} onClick={() => dialog.current?.close()}>Annuleren</button>
            <button type="submit" disabled={saving}>Opslaan</button>
          </div>
        </form>
      </dialog>
    </main>
  );
}
