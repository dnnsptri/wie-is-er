import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/geist';
import './globals.css';

export const metadata: Metadata = {
  title: 'Wie is er?',
  description: 'Bekijk wie er op kantoor is en hoeveel bureaus er vrij zijn.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#e8d4b4', colorScheme: 'light' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nl"><body>{children}</body></html>;
}
