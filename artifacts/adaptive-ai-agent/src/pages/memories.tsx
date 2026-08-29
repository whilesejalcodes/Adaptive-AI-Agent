import { Archive, Brain, Check, Edit3, Info, Plus, Search, Trash2, X } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { WorkspaceShell } from '@/components/workspace-shell';

type MemoryRecord = { id: string; title: string; content: string; kind: string; tags: string[]; updated: string };

const initialMemories: MemoryRecord[] = [
  { id: 'memory-01', title: 'Adaptable rituals', content: 'Sam responds better to flexible directions than strict routines or rigid schedules.', kind: 'preference', tags: ['routines', 'working style'], updated: 'Today, 09:16' },
  { id: 'memory-02', title: 'Morning experiment', content: 'They are trying to keep the first 20 minutes of the day input-free this week.', kind: 'ongoing', tags: ['wellbeing', 'experiment'], updated: 'Today, 09:14' },
  { id: 'memory-03', title: 'Writing project', content: 'A personal essay about attention is in progress; the opening is drafted but the middle feels unclear.', kind: 'project', tags: ['writing', 'creative work'], updated: 'Mar 18' },
  { id: 'memory-04', title: 'Good conversation', content: 'Useful prompts should be specific enough to act on, but leave room for a change of mind.', kind: 'principle', tags: ['communication'], updated: 'Mar 12' },
];

export function MemoriesPage() {
  const [memories, setMemories] = useState(initialMemories);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({ title: '', content: '' });
  const [notice, setNotice] = useState('');
  const filtered = useMemo(() => memories.filter((memory) => `${memory.title} ${memory.content} ${memory.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())), [memories, query]);

  function beginEdit(memory: MemoryRecord) {
    setEditing(memory.id);
    setDraft({ title: memory.title, content: memory.content });
  }
  function saveEdit(id: string) {
    setMemories((current) => current.map((memory) => memory.id === id ? { ...memory, title: draft.title.trim() || memory.title, content: draft.content.trim() || memory.content, updated: 'Just now' } : memory));
    setEditing(null);
    setNotice('Memory updated in this local preview.');
  }
  function removeMemory(id: string) {
    if (!window.confirm('Remove this memory from the local preview?')) return;
    setMemories((current) => current.filter((memory) => memory.id !== id));
    setNotice('Memory removed from this local preview.');
  }
  function createMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim() || !draft.content.trim()) return;
    setMemories((current) => [{ id: `memory-${Date.now()}`, title: draft.title.trim(), content: draft.content.trim(), kind: 'new note', tags: ['unsorted'], updated: 'Just now' }, ...current]);
    setDraft({ title: '', content: '' });
    setShowCreate(false);
    setNotice('New memory added to this local preview.');
  }

  return (
    <WorkspaceShell>
      <div className="topbar"><div className="connection opacity-0" aria-hidden="true"><span>placeholder</span></div><button className="icon-btn" type="button" onClick={() => setNotice('Memory settings will be available when storage is connected.')} aria-label="Memory settings" data-testid="button-memory-settings"><Archive size={17} /></button></div>
      <main className="workspace-content">
        <div className="memory-head">
          <div><div className="eyebrow text-[hsl(var(--primary))]">Your long-term context</div><h1 className="display">Memory, in the open.</h1><p>Small details that help future conversations meet you where you are. Review, refine, or remove them at any time.</p></div>
          <button className="btn btn-primary" type="button" onClick={() => { setShowCreate(true); setEditing(null); setDraft({ title: '', content: '' }); }} data-testid="button-add-memory"><Plus size={15} /> Add memory</button>
        </div>
        <div className="notice"><Info size={15} /><span>This is a Phase 1 visual workspace with local demo records. CRUD controls preview the product surface; nothing is sent or saved remotely.</span></div>
        {notice && <div className="mb-4 flex items-center gap-2 text-xs text-[hsl(var(--primary))]" role="status" data-testid="status-memory-notice"><Check size={14} /> {notice}<button className="icon-btn ml-auto" type="button" onClick={() => setNotice('')} aria-label="Dismiss memory notice" data-testid="button-dismiss-memory-notice"><X size={14} /></button></div>}
        {showCreate && (
          <form className="card mb-4 grid gap-4 p-5" onSubmit={createMemory} data-testid="form-create-memory">
            <div className="flex items-center justify-between"><h2 className="section-heading">Add a memory</h2><button className="icon-btn" type="button" onClick={() => setShowCreate(false)} aria-label="Close add memory form" data-testid="button-close-create-memory"><X size={16} /></button></div>
            <div className="field"><label htmlFor="memory-title">Title</label><input id="memory-title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="A detail worth keeping" data-testid="input-memory-title" required /></div>
            <div className="field"><label htmlFor="memory-content">What should adaptive remember?</label><textarea id="memory-content" value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder="Write it in your own words…" data-testid="input-memory-content" required /></div>
            <div className="flex justify-end gap-2"><button className="btn btn-ghost btn-small" type="button" onClick={() => setShowCreate(false)} data-testid="button-cancel-create-memory">Cancel</button><button className="btn btn-primary btn-small" type="submit" data-testid="button-save-memory">Save local preview</button></div>
          </form>
        )}
        <div className="memory-tools"><div className="search-field"><Search size={15} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your memories" aria-label="Search memories" data-testid="input-search-memories" /></div><span className="ml-auto font-mono text-[10px] text-[hsl(var(--muted-foreground))]" data-testid="text-memory-count">{filtered.length.toString().padStart(2, '0')} records</span></div>
        <div className="memory-grid">
          {filtered.length === 0 ? <div className="card memory-empty" data-testid="empty-memories"><Brain size={25} /><h2>No memories match that search.</h2><p>Try a wider phrase, or add a new detail to the workspace.</p></div> : filtered.map((memory) => (
            <article className="card memory-card" key={memory.id} data-testid={`card-memory-${memory.id}`}>
              {editing === memory.id ? (
                <div className="grid gap-3">
                  <div className="field"><label htmlFor={`edit-title-${memory.id}`}>Title</label><input id={`edit-title-${memory.id}`} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} data-testid={`input-edit-memory-title-${memory.id}`} /></div>
                  <div className="field"><label htmlFor={`edit-content-${memory.id}`}>Memory</label><textarea id={`edit-content-${memory.id}`} value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} data-testid={`input-edit-memory-content-${memory.id}`} /></div>
                  <div className="flex justify-end gap-2"><button className="btn btn-ghost btn-small" type="button" onClick={() => setEditing(null)} data-testid={`button-cancel-edit-${memory.id}`}>Cancel</button><button className="btn btn-primary btn-small" type="button" onClick={() => saveEdit(memory.id)} data-testid={`button-save-edit-${memory.id}`}><Check size={13} /> Save</button></div>
                </div>
              ) : (
                <>
                  <div className="memory-top"><div><div className="memory-kind">{memory.kind}</div><h2 className="mt-1">{memory.title}</h2></div><button className="icon-btn" type="button" onClick={() => beginEdit(memory)} aria-label={`Edit ${memory.title}`} data-testid={`button-edit-memory-${memory.id}`}><Edit3 size={14} /></button></div>
                  <blockquote>{memory.content}</blockquote>
                  <div className="mb-4">{memory.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>
                  <div className="memory-footer"><span>{memory.updated}</span><div className="memory-actions"><button className="icon-btn" type="button" onClick={() => removeMemory(memory.id)} aria-label={`Remove ${memory.title}`} data-testid={`button-delete-memory-${memory.id}`}><Trash2 size={14} /></button></div></div>
                </>
              )}
            </article>
          ))}
        </div>
      </main>
    </WorkspaceShell>
  );
}