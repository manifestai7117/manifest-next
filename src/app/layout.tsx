import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'Manifest — Turn Your Goals Into Reality',
  description: 'AI-powered vision boards, daily coaching, and real accountability.',
  openGraph: {
    title: 'Manifest',
    description: 'Turn your goals into lived reality',
    siteName: 'Manifest',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
      </head>
      <body>
        <Toaster position="bottom-right" toastOptions={{
          style: { background: '#111', color: '#fff', borderLeft: '3px solid #b8922a', borderRadius: '10px', fontSize: '13px' },
          duration: 4000,
        }}/>
        {children}
      </body>
    </html>
  )
}