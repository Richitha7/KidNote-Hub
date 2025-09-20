import React, { useState, useEffect } from 'react';
import { API_BASE } from './config';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [role, setRole] = useState(localStorage.getItem('role') || '');
  const [view, setView] = useState(token ? 'dashboard' : 'login');
  const [form, setForm] = useState({ username: '', password: '', role: 'child', parent_username: '' });
  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [noteForm, setNoteForm] = useState({ title: '', content: '', tags: '', checklist: '' });
  const [selectedNote, setSelectedNote] = useState(null);

  useEffect(() => {
    if (token) { fetchNotes(); fetchFolders(); }
  }, [token]);

  // Generic API helper: auto-JSON when body is object or stringified JSON; skip for FormData
  function api(path, opts = {}) {
    let headers = opts.headers ? { ...opts.headers } : {};
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const hasBody = opts.body !== undefined && opts.body !== null;

    // If caller passed a plain object, stringify it and mark JSON
    if (hasBody && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      opts = { ...opts, body: JSON.stringify(opts.body) };
    }
    // If caller passed a string (JSON.stringify), still set JSON header (not FormData)
    else if (hasBody && typeof opts.body === 'string') {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    return fetch(API_BASE + path, { ...opts, headers }).then(async (r) => {
      if (!r.ok) { const t = await r.text(); throw new Error(t || r.statusText); }
      if (r.status === 204) return null;
      return r.json();
    });
  }

  async function signup(e) {
    e.preventDefault();
    try {
      await api('/signup', {
        method: 'POST',
        body: {
          username: form.username,
          password: form.password,
          role: form.role,
          parent_username: form.parent_username || null
        }
      });
      alert('Signup successful. Please login.');
      setView('login');
    } catch (err) {
      alert('Signup failed: ' + err.message);
    }
  }

  async function login(e) {
    e.preventDefault();
    try {
      const data = await api('/login', {
        method: 'POST',
        body: { username: form.username, password: form.password }
      });
      setToken(data.access_token);
      setRole(data.role);
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('role', data.role);
      setView('dashboard');
    } catch (err) {
      alert('Login failed: ' + err.message);
    }
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setToken('');
    setRole('');
    setView('login');
    setNotes([]);
    setFolders([]);
  }

  async function fetchNotes() {
    try {
      const data = await api('/notes');
      setNotes(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchFolders() {
    try {
      const data = await api('/folders');
      setFolders(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function createNote(e) {
    e.preventDefault();
    const payload = {
      title: noteForm.title,
      content: noteForm.content,
      tags: noteForm.tags ? noteForm.tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
      checkbox_items: noteForm.checklist ? noteForm.checklist.split('\n').map((t) => ({ text: t.trim(), checked: false })) : []
    };
    try {
      const n = await api('/notes', { method: 'POST', body: payload });
      setNotes((prev) => [n, ...prev]);
      setNoteForm({ title: '', content: '', tags: '', checklist: '' });
      alert('Note created');
    } catch (err) {
      alert('Create note failed: ' + err.message);
    }
  }

  async function deleteNote(id) {
    if (!window.confirm('Delete this note?')) return;
    try {
      await api('/notes/' + id, { method: 'DELETE' });
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  }

  async function selectNote(note) {
    setSelectedNote(note);
    setNoteForm({
      title: note.title,
      content: note.content,
      tags: (note.tags || []).join(','),
      checklist: (note.checkbox_items || []).map((it) => it.text).join('\n')
    });
  }

  async function updateNote(e) {
    e.preventDefault();
    if (!selectedNote) return;
    const payload = {
      title: noteForm.title,
      content: noteForm.content,
      tags: noteForm.tags ? noteForm.tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
      checkbox_items: noteForm.checklist ? noteForm.checklist.split('\n').map((t) => ({ text: t.trim(), checked: false })) : []
    };
    try {
      const updated = await api('/notes/' + selectedNote.id, { method: 'PUT', body: payload });
      setNotes((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setSelectedNote(null);
      setNoteForm({ title: '', content: '', tags: '', checklist: '' });
      alert('Note updated');
    } catch (err) {
      alert('Update failed: ' + err.message);
    }
  }

  return (
    <div>
      <header>
        <div className="logo">Children Notes</div>
        {token && (
          <div style={{ color: 'white' }}>
            Welcome, {form.username || 'user'} <button className="btn" onClick={logout} style={{ marginLeft: 12 }}>Logout</button>
          </div>
        )}
      </header>

      <div className="container">
        {!token && view === 'login' && (
          <div style={{ maxWidth: 420, margin: '0 auto' }}>
            <h2>Login</h2>
            <form onSubmit={login}>
              <input placeholder="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              <input placeholder="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <button className="btn" type="submit">Login</button>
              <button className="btn" type="button" onClick={() => setView('signup')} style={{ background: '#4ade80' }}>Signup</button>
            </form>
            <div className="muted" style={{ marginTop: 12 }}>Tip: sign up a parent first, then a child with parent_username.</div>
          </div>
        )}

        {!token && view === 'signup' && (
          <div style={{ maxWidth: 420, margin: '0 auto' }}>
            <h2>Signup</h2>
            <form onSubmit={signup}>
              <input placeholder="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              <input placeholder="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="child">Child</option>
                <option value="parent">Parent</option>
              </select>
              <input placeholder="parent_username (if child)" value={form.parent_username} onChange={(e) => setForm({ ...form, parent_username: e.target.value })} />
              <button className="btn" type="submit">Create account</button>
              <button className="btn" type="button" onClick={() => setView('login')} style={{ background: '#94a3b8' }}>Back</button>
            </form>
          </div>
        )}

        {token && (
          <>
            <aside className="sidebar">
              <h3>Folders</h3>
              <div style={{ marginBottom: 10 }}>
                <button
                  className="btn"
                  onClick={async () => {
                    const name = prompt('Folder name');
                    if (!name) return;
                    try {
                      const f = await api('/folders', { method: 'POST', body: { name } });
                      setFolders((prev) => [f, ...prev]);
                    } catch (err) {
                      alert('Create folder failed: ' + err.message);
                    }
                  }}
                >
                  New Folder
                </button>
              </div>
              <div>
                {folders.length ? folders.map((f) => (
                  <div key={f.id} className="folder-item">
                    {f.name} <span className="small">by {f.owner_username}</span>
                  </div>
                )) : 'No folders'}
              </div>
              <hr style={{ margin: '12px 0' }} />
              <div className="muted small">Screenshot</div>
              <img src="/assets/screenshot.png" alt="screenshot" style={{ width: '100%', borderRadius: 8, marginTop: 8 }} />
            </aside>

            <div className="main">
              <div className="list">
                <div className="top-actions">
                  <h3>Notes</h3>
                  <div>
                    <button className="btn" onClick={() => { setSelectedNote(null); setNoteForm({ title: '', content: '', tags: '', checklist: '' }); }}>
                      New Note
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  {notes.length ? notes.map((n) => (
                    <div className="note-card" key={n.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{n.title}</strong>
                        <div>
                          <button className="small" onClick={() => selectNote(n)}>Edit</button>
                          {role === 'child' && <button className="small" onClick={() => deleteNote(n.id)}>Delete</button>}
                        </div>
                      </div>
                      <div className="muted">{n.content}</div>
                      <div style={{ marginTop: 8 }}>
                        {n.tags && n.tags.map((t, i) => (<span className="tag" key={i}>{t}</span>))}
                      </div>
                      <div className="small">By {n.owner_username}</div>
                    </div>
                  )) : <div className="muted">No notes yet</div>}
                </div>
              </div>

              <div className="editor">
                <h3>{selectedNote ? 'Edit Note' : 'New Note'}</h3>
                <form onSubmit={selectedNote ? updateNote : createNote}>
                  <input placeholder="Title" value={noteForm.title} onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })} required />
                  <textarea placeholder="Content" value={noteForm.content} onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })} rows={6} />
                  <input placeholder="Tags (comma separated)" value={noteForm.tags} onChange={(e) => setNoteForm({ ...noteForm, tags: e.target.value })} />
                  <textarea placeholder="Checklist items (one per line)" value={noteForm.checklist} onChange={(e) => setNoteForm({ ...noteForm, checklist: e.target.value })} rows={4} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" type="submit">{selectedNote ? 'Update' : 'Create'}</button>
                    {selectedNote && (
                      <button
                        type="button"
                        className="btn"
                        style={{ background: '#ef4444' }}
                        onClick={() => { if (window.confirm('Delete note?')) deleteNote(selectedNote.id); }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
