import { type FormEvent, useEffect, useState } from 'react';

type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

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
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
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

      if (!response.ok) throw new Error(await getErrorMessage(response));

      setNotes((await response.json()) as Note[]);
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'Could not load notes.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadNotes();
  }, []);

  function resetForm() {
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

      resetForm();
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : 'Could not save the note.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(note: Note) {
    const approved = window.confirm(`Delete "${note.title}"? This cannot be undone.`);

    if (!approved) return;

    setDeletingId(note.id);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/notes/${note.id}`, { method: 'DELETE' });

      if (!response.ok) throw new Error(await getErrorMessage(response));

      setNotes((currentNotes) => currentNotes.filter((currentNote) => currentNote.id !== note.id));

      if (editingNote?.id === note.id) resetForm();

      setSuccessMessage('Note deleted.');
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : 'Could not delete the note.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <p className="eyebrow">Cloud Notes</p>
        <h1>Write it down. Keep learning.</h1>
        <p className="intro">
          Your notes travel from this React form to the Node.js API. For now, they live in
          temporary memory; PostgreSQL will make them permanent later.
        </p>
      </header>

      <div className="workspace">
        <section className="composer card" aria-labelledby="new-note-heading">
          <h2 id="new-note-heading">{editingNote ? 'Edit note' : 'New note'}</h2>
          <form onSubmit={handleSubmit}>
            <label htmlFor="note-title">Title</label>
            <input
              id="note-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              placeholder="What do you want to remember?"
              disabled={isSaving}
              required
            />

            <label htmlFor="note-content">Content</label>
            <textarea
              id="note-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={10_000}
              placeholder="Write your note here…"
              rows={7}
              disabled={isSaving}
              required
            />

            {submitError && <p className="message error" role="alert">{submitError}</p>}
            {successMessage && <p className="message success" role="status">{successMessage}</p>}

            <div className="form-actions">
              <button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving…' : editingNote ? 'Save changes' : 'Save note'}
              </button>
              {editingNote && (
                <button type="button" className="secondary-button" onClick={resetForm} disabled={isSaving}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="notes-panel" aria-labelledby="your-notes-heading">
          <div className="notes-heading">
            <div>
              <p className="section-label">Your collection</p>
              <h2 id="your-notes-heading">Notes</h2>
            </div>
            {!isLoading && !loadError && <span className="note-count">{notes.length}</span>}
          </div>

          {isLoading && <p className="state card">Loading notes…</p>}

          {loadError && (
            <div className="state card error-state" role="alert">
              <p>We could not load your notes: {loadError}</p>
              <button type="button" className="secondary-button" onClick={() => void loadNotes()}>
                Try again
              </button>
            </div>
          )}

          {!isLoading && !loadError && notes.length === 0 && (
            <p className="state card">No notes yet. Your first note will appear here.</p>
          )}

          {!isLoading && !loadError && notes.length > 0 && (
            <ol className="notes-list">
              {notes.map((note) => (
                <li key={note.id} className="note-card card">
                  <article>
                    <p className="note-date">Created {formatDate(note.createdAt)}</p>
                    <h3>{note.title}</h3>
                    <p className="note-content">{note.content}</p>
                    <div className="note-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => startEditing(note)}
                        disabled={isSaving || deletingId === note.id}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="delete-button"
                        onClick={() => void handleDelete(note)}
                        disabled={isSaving || deletingId === note.id}
                      >
                        {deletingId === note.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </article>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}
