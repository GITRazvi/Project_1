import { useState } from 'react';

type Status = 'idle' | 'checking' | 'healthy' | 'database-down' | 'unreachable';

export default function ServiceStatus() {
  const [status, setStatus] = useState<Status>('idle');

  async function checkStatus() {
    setStatus('checking');
    try {
      const response = await fetch('/api/status', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      const body: unknown = await response.json();
      if (typeof body !== 'object' || body === null || !('api' in body) || body.api !== 'available' || !('database' in body)) {
        throw new Error('Invalid status response');
      }
      if (response.ok && body.database === 'available') setStatus('healthy');
      else if (response.status === 503 && body.database === 'unavailable') setStatus('database-down');
      else throw new Error('Unexpected status response');
    } catch {
      setStatus('unreachable');
    }
  }

  return (
    <section className="service-status card" aria-labelledby="status-heading">
      <h2 id="status-heading">Service status</h2>
      <button type="button" className="secondary-button" onClick={() => void checkStatus()} disabled={status === 'checking'}>
        {status === 'checking' ? 'Checking…' : 'Check status'}
      </button>
      <div aria-live="polite">
        <p>Web app: loaded</p>
        <p>API: {status === 'healthy' || status === 'database-down' ? 'reachable' : status === 'unreachable' ? 'unreachable' : 'not checked'}</p>
        <p>Database: {status === 'healthy' ? 'connected' : status === 'database-down' ? 'unavailable' : 'unknown'}</p>
      </div>
      <p className="status-hint">A loaded page confirms the web app loaded; it does not continuously monitor the server.</p>
    </section>
  );
}
