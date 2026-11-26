import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ServiceStatus from './ServiceStatus';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('shows when the API responds but the database is unavailable', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ api: 'available', database: 'unavailable' }) })));
  render(<ServiceStatus />);
  fireEvent.click(screen.getByRole('button', { name: 'Check status' }));
  expect(await screen.findByText('Database: unavailable')).toBeInTheDocument();
  expect(screen.getByText('API: reachable')).toBeInTheDocument();
});

it('shows an unknown database when the API cannot be reached', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
  render(<ServiceStatus />);
  fireEvent.click(screen.getByRole('button', { name: 'Check status' }));
  expect(await screen.findByText('API: unreachable')).toBeInTheDocument();
  expect(screen.getByText('Database: unknown')).toBeInTheDocument();
});
