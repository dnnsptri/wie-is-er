import AttendanceBoard from './attendance-board';
import { calendar } from '@/lib/board';
import { readBoard } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const office = calendar();
  const data = await readBoard().catch((error: unknown) => {
    console.error('Loading the board failed', error);
    return null;
  });
  return <AttendanceBoard initialCalendar={office} initialData={data} />;
}
