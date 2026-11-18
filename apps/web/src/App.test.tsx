import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const testUser = {
  id: '8c47a355-6576-4d30-a2ca-c94b6b5c5a3c',
  email: 'learner@example.test',
  createdAt: '2026-11-18T00:00:00.000Z',
};

function apiResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Cloud Notes interface', () => {
  it('shows login by default and lets a visitor switch to sign-up', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => apiResponse({ message: 'Not logged in.' }, 401)));

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Need an account? Sign up' }));
    expect(screen.getByRole('heading', { name: 'Create your space.' })).toBeInTheDocument();
  });

  it('shows an existing user and their notes', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/auth/me') return apiResponse(testUser);
      if (String(input) === '/api/notes') {
        return apiResponse([{
          id: 'note-1',
          title: 'Cloud practice',
          content: 'Learn how sessions protect notes.',
          createdAt: '2026-11-18T10:00:00.000Z',
          updatedAt: '2026-11-18T10:00:00.000Z',
        }]);
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByText(testUser.email)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Cloud practice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('logs in and then returns to the login screen after logout', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/auth/me') return apiResponse({ message: 'Not logged in.' }, 401);
      if (String(input) === '/api/auth/login') return apiResponse(testUser);
      if (String(input) === '/api/notes') return apiResponse([]);
      if (String(input) === '/api/auth/logout' && init?.method === 'POST') return apiResponse(null, 204);
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    const email = await screen.findByLabelText('Email');
    fireEvent.change(email, { target: { value: testUser.email } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-horse-battery-staple' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText(testUser.email)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({ method: 'POST' }));

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument();
  });
});
