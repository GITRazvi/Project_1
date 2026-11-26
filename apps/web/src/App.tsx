import { type FormEvent, useEffect, useState } from 'react';
import ServiceStatus from './ServiceStatus';

type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type User = {
  id: string;
  email: string;
  createdAt: string;
};

type AuthMode = 'login' | 'register';

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === 'string') return body.message;
  } catch {
    // Use the status message when the response does not contain JSON.
  }

  return `Request failed with status ${response.status}.`;
}

function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(isoDate));
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadNotes() {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await fetch('/api/notes');

      if (response.status === 401) {
        setUser(null);
        setNotes([]);
        return;
      }
      if (!response.ok) throw new Error(await getErrorMessage(response));

      setNotes((await response.json()) as Note[]);
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'Could not load notes.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    async function loadSession() {
      try {
        const response = await fetch('/api/auth/me');

        if (response.status === 401) return;
        if (!response.ok) throw new Error(await getErrorMessage(response));

        setUser((await response.json()) as User);
        await loadNotes();
      } catch (error: unknown) {
        setAuthError(error instanceof Error ? error.message : 'Could not check your session.');
      } finally {
        setIsCheckingSession(false);
      }
    }

    void loadSession();
  }, []);

  function resetNoteForm() {
    setEditingNote(null);
    setTitle('');
    setContent('');
    setSubmitError(null);
  }

  function startEditing(note: Note) {
    setEditingNote(note);
    setTitle(note.title);
    setContent(note.content);
    setSubmitError(null);
    setSuccessMessage(null);
  }

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);
    setIsAuthenticating(true);

    try {
      const response = await fetch(`/api/auth/${authMode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!response.ok) throw new Error(await getErrorMessage(response));

      setUser((await response.json()) as User);
      setPassword('');
      await loadNotes();
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error.message : 'Could not sign you in.');
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setNotes([]);
    setLoadError(null);
    setSuccessMessage(null);
    resetNoteForm();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (!trimmedTitle || !trimmedContent) {
      setSubmitError('Please add both a title and note content.');
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(editingNote ? `/api/notes/${editingNote.id}` : '/api/notes', {
        method: editingNote ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmedTitle, content: trimmedContent }),
      });

      if (!response.ok) throw new Error(await getErrorMessage(response));

      const savedNote = (await response.json()) as Note;

      if (editingNote) {
        setNotes((currentNotes) => currentNotes.map((note) => (
          note.id === savedNote.id ? savedNote : note
        )));
        setSuccessMessage('Note updated.');
      } else {
        setNotes((currentNotes) => [savedNote, ...currentNotes]);
        setSuccessMessage('Note saved.');
      }

      resetNoteForm();
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : 'Could not save the note.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(note: Note) {
    if (!window.confirm(`Delete "${note.title}"? This cannot be undone.`)) return;

    setDeletingId(note.id);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/notes/${note.id}`, { method: 'DELETE' });

      if (!response.ok) throw new Error(await getErrorMessage(response));

      setNotes((currentNotes) => currentNotes.filter((currentNote) => currentNote.id !== note.id));
      if (editingNote?.id === note.id) resetNoteForm();
      setSuccessMessage('Note deleted.');
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : 'Could not delete the note.');
    } finally {
      setDeletingId(null);
    }
  }

  if (isCheckingSession) {
    return <main className="auth-shell"><p className="state card">Checking your session…</p></main>;
  }

  if (!user) {
    return (
      <main className="auth-shell">
        <section className="auth-card card" aria-labelledby="auth-heading">
          <p className="eyebrow">Cloud Notes</p>
          <h1 id="auth-heading">{authMode === 'login' ? 'Welcome back.' : 'Create your space.'}</h1>
          <p className="intro">Your account keeps your notes separate from everyone else’s.</p>
          <form onSubmit={handleAuth}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isAuthenticating}
              required
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              maxLength={72}
              disabled={isAuthenticating}
              required
            />
            {authError && <p className="message error" role="alert">{authError}</p>}
            <button type="submit" disabled={isAuthenticating}>
              {isAuthenticating ? 'Please wait…' : authMode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setAuthMode((mode) => mode === 'login' ? 'register' : 'login');
              setAuthError(null);
            }}
          >
            {authMode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Log in'}
          </button>
        </section>
        <ServiceStatus />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <div className="header-row">
          <div>
            <p className="eyebrow">Cloud Notes</p>
            <h1>Write it down. Keep learning.</h1>
          </div>
          <div className="account-actions">
            <span>{user.email}</span>
            <button type="button" className="secondary-button" onClick={() => void handleLogout()}>
              Log out
            </button>
          </div>
        </div>
        <p className="intro">Your notes are private to your account and stored in PostgreSQL.</p>
      </header>

      <div className="workspace">
        <section className="composer card" aria-labelledby="new-note-heading">
          <h2 id="new-note-heading">{editingNote ? 'Edit note' : 'New note'}</h2>
          <form onSubmit={handleSubmit}>
            <label htmlFor="note-title">Title</label>
            <input id="note-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="What do you want to remember?" disabled={isSaving} required />
            <label htmlFor="note-content">Content</label>
            <textarea id="note-content" value={content} onChange={(event) => setContent(event.target.value)} maxLength={10_000} placeholder="Write your note here…" rows={7} disabled={isSaving} required />
            {submitError && <p className="message error" role="alert">{submitError}</p>}
            {successMessage && <p className="message success" role="status">{successMessage}</p>}
            <div className="form-actions">
              <button type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : editingNote ? 'Save changes' : 'Save note'}</button>
              {editingNote && <button type="button" className="secondary-button" onClick={resetNoteForm} disabled={isSaving}>Cancel</button>}
            </div>
          </form>
        </section>

        <section className="notes-panel" aria-labelledby="your-notes-heading">
          <div className="notes-heading">
            <div><p className="section-label">Your collection</p><h2 id="your-notes-heading">Notes</h2></div>
            {!isLoading && !loadError && <span className="note-count">{notes.length}</span>}
          </div>
          {isLoading && <p className="state card">Loading notes…</p>}
          {loadError && <div className="state card error-state" role="alert"><p>We could not load your notes: {loadError}</p><button type="button" className="secondary-button" onClick={() => void loadNotes()}>Try again</button></div>}
          {!isLoading && !loadError && notes.length === 0 && <p className="state card">No notes yet. Your first note will appear here.</p>}
          {!isLoading && !loadError && notes.length > 0 && (
            <ol className="notes-list">
              {notes.map((note) => (
                <li key={note.id} className="note-card card">
                  <article>
                    <p className="note-date">Created {formatDate(note.createdAt)}</p>
                    <h3>{note.title}</h3><p className="note-content">{note.content}</p>
                    <div className="note-actions">
                      <button type="button" className="secondary-button" onClick={() => startEditing(note)} disabled={isSaving || deletingId === note.id}>Edit</button>
                      <button type="button" className="delete-button" onClick={() => void handleDelete(note)} disabled={isSaving || deletingId === note.id}>{deletingId === note.id ? 'Deleting…' : 'Delete'}</button>
                    </div>
                  </article>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
      <ServiceStatus />
    </main>
  );
}
