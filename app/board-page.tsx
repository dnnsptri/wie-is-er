import AttendanceBoard from './attendance-board';
import { calendar, type PersonId } from '@/lib/board';
import { readBoard } from '@/lib/store';

export default async function BoardPage({ personalId }: { personalId?: PersonId }) {
  const office = calendar();
  const data = await readBoard().catch((error: unknown) => {
    console.error('Loading the board failed', error);
    return null;
  });

  return <AttendanceBoard initialCalendar={office} initialData={data} personalId={personalId} />;
}
