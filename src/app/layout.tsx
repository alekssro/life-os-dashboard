import { ThemeProvider } from '@/lib/theme';
import type { Metadata } from 'next';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { SWRegistration } from '@/components/SWRegistration';
import { BackGestureProvider } from '@/components/BackGestureProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Life OS | Personal Operations Dashboard',
  description: 'Personal Operations Dashboard, built for desktop, mobile, and e-paper tablets.',
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Life OS',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="warm">
      <head>
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Life OS" />
        <meta name="theme-color" content="#4A6FA5" media="(prefers-color-scheme: light)" />
      </head>
      <body className="min-h-screen">
        <ThemeProvider>
          <BackGestureProvider>
            {children}
          </BackGestureProvider>
          <SWRegistration />
          <PWAInstallPrompt />
        </ThemeProvider>
      </body>
    </html>
  );
}
