'use client' // Error boundaries must be Client Components

// Last resort when the root layout itself fails. It replaces the whole document, so global styles and
// fonts aren't available: styles are inline and use the same palette as globals.css.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0e0e0d', color: '#edece8', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>
        <title>BrainCoach — something went wrong</title>
        <main role="alert" style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 400, fontSize: 30, margin: 0 }}>BrainCoach hit a problem.</h1>
          <p style={{ color: '#a8a69f', fontSize: 14, lineHeight: 1.6, marginTop: 12 }}>
            Please try again. If you were in a session, it&apos;s saved on this device.
          </p>
          {error.digest && <p style={{ color: '#8a8881', fontSize: 12 }}>Reference: {error.digest}</p>}
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 20, height: 44, padding: '0 20px', borderRadius: 12, border: 0, background: '#9cc9a9', color: '#0d1a11', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
