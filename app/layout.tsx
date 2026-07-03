import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'The Beatdown',
  description: 'Competitive music sequencer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the inline script below may set data-theme before React
    // hydrates (see node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md)
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`,
          }}
        />
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
