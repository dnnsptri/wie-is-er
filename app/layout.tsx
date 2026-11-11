import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/geist';
import './globals.css';
import { boardDescription, boardTitle, shareMetadata } from '@/lib/share-metadata';

export const metadata: Metadata = {
  metadataBase: new URL('https://wie-is-er.vercel.app'),
  title: boardTitle,
  description: boardDescription,
  ...shareMetadata(),
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#e8d4b4', colorScheme: 'light' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nl"><body>{children}</body></html>;
}
