import type { Metadata, Viewport } from 'next';
import { EPaperDashboard } from '@/components/EPaperDashboard';

/**
 * Dedicated e-paper terminal route.
 *
 * Renders outside the main app shell (no sidebar / top bar / theme chrome) so
 * the primary desktop UI is untouched. Target a kiosk browser at 800×480 —
 * e.g. a reTerminal whose F1–F3 keys map to Sync / Context / Buffer.
 */
export const metadata: Metadata = {
  title: 'Life OS | E-Paper',
  description: 'Monochrome 800×480 glanceable dashboard for e-paper terminals.',
};

// Pin the layout viewport to the panel width so the fixed 800×480 grid is
// never scaled or scrolled on the e-paper device's browser.
export const viewport: Viewport = {
  width: 800,
  initialScale: 1,
};

export default function EPaperPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center overscroll-none">
      <EPaperDashboard />
    </div>
  );
}
