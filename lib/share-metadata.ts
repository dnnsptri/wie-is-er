import type { Metadata } from 'next';
import type { Person } from './board';

export const boardTitle = 'Wie is er vandaag bij Backspace';
export const boardDescription = 'Bekijk wie er op kantoor is en hoeveel bureaus er vrij zijn.';

export function shareMetadata(person?: Person): Metadata {
  const title = person ? `${person.name} · ${boardTitle}` : boardTitle;
  const description = person ? 'Bekijk het bord en pas je aanwezigheid aan.' : boardDescription;
  const image = {
    url: `/share/${person?.id ?? 'board'}.jpg`,
    width: 1200,
    height: 630,
    type: 'image/jpeg',
    alt: person ? `De portretkaart van ${person.name}` : 'Het Backspace bord met alle negen portretkaarten',
  };

  return {
    openGraph: {
      type: 'website',
      locale: 'nl_NL',
      siteName: 'Backspace',
      url: person ? `/${person.id}` : '/',
      title,
      description,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}
