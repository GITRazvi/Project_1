import { useEffect, useState } from 'react';

type HealthResponse = {
  status: string;
  service: string;
  timestamp: string;
};

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then(async (response) => {
        if (!response.ok) throw new Error('The API did not respond successfully.');
        return response.json() as Promise<HealthResponse>;
      })
      .then(setHealth)
      .catch((requestError: unknown) => {
        setError(requestError instanceof Error ? requestError.message : 'Could not reach the API.');
      });
  }, []);

  return (
    <main>
      <p className="eyebrow">React + Node.js + TypeScript</p>
      <h1>Cloud Learning Project</h1>
      <p>Use this starter to practise Git, local development, containers, CI, and cloud deployment.</p>
      <section aria-label="API connection status">
        <h2>API connection</h2>
        {health && <p className="success">Connected to {health.service}: {health.status}</p>}
        {error && <p className="error">{error}</p>}
        {!health && !error && <p>Checking the API…</p>}
      </section>
    </main>
  );
}
