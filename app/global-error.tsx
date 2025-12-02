'use client';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html>
            <body>
                <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
                    <h2>Something went wrong!</h2>
                    <pre style={{ color: 'red', background: '#f0f0f0', padding: '10px', borderRadius: '5px' }}>
                        {error.message}
                    </pre>
                    <button
                        onClick={() => reset()}
                        style={{ marginTop: '10px', padding: '8px 16px', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Try again
                    </button>
                </div>
            </body>
        </html>
    );
}
