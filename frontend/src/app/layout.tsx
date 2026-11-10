import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ServiceWorkerRegister } from './ServiceWorkerRegister';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-mono-face', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'ColdChain Pulse', template: '%s · ColdChain Pulse' },
  description: 'Live cold-chain monitoring for MedSwift Logistics',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#0F1B2A',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
