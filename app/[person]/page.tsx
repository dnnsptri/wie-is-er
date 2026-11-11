import { notFound } from 'next/navigation';
import BoardPage from '../board-page';
import { people } from '@/lib/board';
import { shareMetadata } from '@/lib/share-metadata';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ person: string }> };

async function getPerson(params: PageProps['params']) {
  const { person } = await params;
  const match = people.find(({ id }) => id === person);
  if (!match) notFound();
  return match;
}

export async function generateMetadata({ params }: PageProps) {
  return shareMetadata(await getPerson(params));
}

export default async function PersonalBoard({ params }: PageProps) {
  const person = await getPerson(params);
  return <BoardPage personalId={person.id} />;
}
