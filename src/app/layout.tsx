import { ThemeProvider } from '@/lib/theme';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Life OS | Personal Operations Dashboard',
  description: 'Personal Operations Dashboard, built for desktop, mobile, and e-paper tablets.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="warm">
      <body className="min-h-screen">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
