import type { Metadata, Viewport } from 'next'
import { Inter, Instrument_Serif } from 'next/font/google'
import './globals.css'
import { AuthProvider } from './context/AuthContext'
import Toaster from './components/Toaster'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

// Display serif for headings and large numerals — gives the minimal UI a quiet, editorial character.
const instrument = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-instrument',
})

export const metadata: Metadata = {
  title: 'BrainCoach',
  description: 'A calm focus coach that learns how your attention works.',
}

export const viewport: Viewport = {
  themeColor: '#0e0e0d',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${instrument.variable}`}>
      <body className="min-h-screen">
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
      </body>
    </html>
  )
}
