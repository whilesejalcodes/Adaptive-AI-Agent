import { Archive, Brain, Check, Edit3, Info, Plus, Search, Trash2, X } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListMemoriesQueryKey,
  useCreateMemory,
  useDeleteMemory,
  useListMemories,
  useUpdateMemory,
  type Memory,
  type MemoryType,
} from '@workspace/api-client-react';
import { WorkspaceShell } from '@/components/workspace-shell';
import { useAuth } from '@/components/auth-provider';

const memoryTypes: MemoryType[] = ['preference', 'interest', 'goal', 'fact', 'instruction', 'context'];

function memoryDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The memory operation could not be completed.';
}

export function MemoriesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const memoriesQuery = useListMemories({
    query: {
      queryKey: getListMemoriesQueryKey(),
      enabled: Boolean(user),
      retry: false,
    },
  });
  const createMutation = useCreateMemory();
  const updateMutation = useUpdateMemory();
  const deleteMutation = useDeleteMemory();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<{ text: string; type: MemoryType }>({
    text: '',
    type: 'context',
  });
  const [notice, setNotice] = useState('');
  const memories = memoriesQuery.data ?? [];
  const filtered = useMemo(
    () => memories.filter((memory) =>
      `${memory.type} ${memory.text}`.toLowerCase().includes(query.toLowerCase())),
    [memories, query],
  );
  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  function beginEdit(memory: Memory) {
    setShowCreate(false);
    setEditing(memory.id);
    setDraft({ text: memory.text, type: memory.type });
    setNotice('');
  }

  async function refreshMemories() {
    await queryClient.invalidateQueries({ queryKey: getListMemoriesQueryKey() });
  }

  async function saveEdit(id: string) {
    if (!draft.text.trim() || isMutating) return;
    setNotice('');
    try {
      await updateMutation.mutateAsync({
        memoryId: id,
        data: { text: draft.text.trim(), type: draft.type },
      });
      await refreshMemories();
      setEditing(null);
      setNotice('Memory updated and re-indexed.');
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }

  async function removeMemory(memory: Memory) {
    if (!window.confirm(`Remove this ${memory.type} memory? This cannot be undone.`) || isMutating) return;
    setNotice('');
    try {
      await deleteMutation.mutateAsync({ memoryId: memory.id });
      await refreshMemories();
      setEditing((current) => current === memory.id ? null : current);
      setNotice('Memory removed from long-term context.');
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }

  async function createMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.text.trim() || isMutating) return;
    setNotice('');
    try {
      await createMutation.mutateAsync({
        data: { text: draft.text.trim(), type: draft.type },
      });
      await refreshMemories();
      setDraft({ text: '', type: 'context' });
      setShowCreate(false);
      setNotice('Memory saved and indexed.');
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }

  return (
    <WorkspaceShell>
      <div className="topbar"><div className="connection opacity-0" aria-hidden="true"><span>placeholder</span></div><button className="icon-btn" type="button" onClick={() => setNotice('Only indexed memories can be recalled in future conversations.')} aria-label="Memory settings" data-testid="button-memory-settings"><Archive size={17} /></button></div>
      <main className="workspace-content">
        <div className="memory-head">
          <div><div className="eyebrow text-[hsl(var(--primary))]">Your long-term context</div><h1 className="display">Memory, in the open.</h1><p>Small details that help future conversations meet you where you are. Review, refine, or remove them at any time.</p></div>
          <button className="btn btn-primary" type="button" onClick={() => { setShowCreate(true); setEditing(null); setDraft({ text: '', type: 'context' }); setNotice(''); }} data-testid="button-add-memory"><Plus size={15} /> Add memory</button>
        </div>
        <div className="notice"><Info size={15} /><span>Relevant indexed memories can now inform Gemini responses. They remain separate context, never higher-priority instructions.</span></div>
        {notice && <div className="mb-4 flex items-center gap-2 text-xs text-[hsl(var(--primary))]" role="status" data-testid="status-memory-notice"><Check size={14} /> {notice}<button className="icon-btn ml-auto" type="button" onClick={() => setNotice('')} aria-label="Dismiss memory notice" data-testid="button-dismiss-memory-notice"><X size={14} /></button></div>}
        {showCreate && (
          <form className="card mb-4 grid gap-4 p-5" onSubmit={createMemory} data-testid="form-create-memory">
            <div className="flex items-center justify-between"><h2 className="section-heading">Add a memory</h2><button className="icon-btn" type="button" onClick={() => setShowCreate(false)} aria-label="Close add memory form" data-testid="button-close-create-memory"><X size={16} /></button></div>
            <div className="field"><label htmlFor="memory-type">Type</label><select id="memory-type" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as MemoryType })} data-testid="select-memory-type">{memoryTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
            <div className="field"><label htmlFor="memory-content">What should adaptive remember?</label><textarea id="memory-content" value={draft.text} onChange={(event) => setDraft({ ...draft, text: event.target.value })} placeholder="Write it in your own words…" maxLength={500} data-testid="input-memory-content" required /></div>
            <div className="flex justify-end gap-2"><button className="btn btn-ghost btn-small" type="button" onClick={() => setShowCreate(false)} data-testid="button-cancel-create-memory">Cancel</button><button className="btn btn-primary btn-small" type="submit" disabled={isMutating || draft.text.trim().length < 3} data-testid="button-save-memory">{createMutation.isPending ? 'Indexing…' : 'Save memory'}</button></div>
          </form>
        )}
        <div className="memory-tools"><div className="search-field"><Search size={15} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your memories" aria-label="Search memories" data-testid="input-search-memories" /></div><span className="ml-auto font-mono text-[10px] text-[hsl(var(--muted-foreground))]" data-testid="text-memory-count">{filtered.length.toString().padStart(2, '0')} records</span></div>
        {memoriesQuery.isError && <div className="card memory-empty" role="alert" data-testid="error-memories"><Brain size={25} /><h2>Memories could not be loaded.</h2><p>Check your connection or sign in again, then retry.</p><button className="btn btn-ghost btn-small mx-auto mt-4" type="button" onClick={() => memoriesQuery.refetch()} data-testid="button-retry-memories">Retry</button></div>}
        {!memoriesQuery.isError && (
          <div className="memory-grid">
            {memoriesQuery.isLoading ? <div className="card memory-empty" data-testid="loading-memories"><Brain size={25} /><h2>Loading your memories…</h2><p>Retrieving your private long-term context.</p></div> : filtered.length === 0 ? <div className="card memory-empty" data-testid="empty-memories"><Brain size={25} /><h2>{query ? 'No memories match that search.' : 'No memories yet.'}</h2><p>{query ? 'Try a wider phrase.' : 'Useful preferences, goals, and facts from conversations will appear here.'}</p></div> : filtered.map((memory) => (
              <article className="card memory-card" key={memory.id} data-testid={`card-memory-${memory.id}`}>
                {editing === memory.id ? (
                  <div className="grid gap-3">
                    <div className="field"><label htmlFor={`edit-type-${memory.id}`}>Type</label><select id={`edit-type-${memory.id}`} value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as MemoryType })} data-testid={`select-edit-memory-type-${memory.id}`}>{memoryTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
                    <div className="field"><label htmlFor={`edit-content-${memory.id}`}>Memory</label><textarea id={`edit-content-${memory.id}`} value={draft.text} onChange={(event) => setDraft({ ...draft, text: event.target.value })} maxLength={500} data-testid={`input-edit-memory-content-${memory.id}`} /></div>
                    <div className="flex justify-end gap-2"><button className="btn btn-ghost btn-small" type="button" onClick={() => setEditing(null)} data-testid={`button-cancel-edit-${memory.id}`}>Cancel</button><button className="btn btn-primary btn-small" type="button" onClick={() => saveEdit(memory.id)} disabled={isMutating || draft.text.trim().length < 3} data-testid={`button-save-edit-${memory.id}`}><Check size={13} /> {updateMutation.isPending ? 'Indexing…' : 'Save'}</button></div>
                  </div>
                ) : (
                  <>
                    <div className="memory-top"><div><div className="memory-kind">{memory.type}</div><h2 className="mt-1">{memory.text.slice(0, 62)}{memory.text.length > 62 ? '…' : ''}</h2></div><button className="icon-btn" type="button" onClick={() => beginEdit(memory)} aria-label={`Edit ${memory.type} memory`} data-testid={`button-edit-memory-${memory.id}`}><Edit3 size={14} /></button></div>
                    <blockquote>{memory.text}</blockquote>
                    <div className="mb-4"><span className="tag">{memory.vectorStatus}</span>{memory.sourceConversationId === 'manual' && <span className="tag">added by you</span>}</div>
                    <div className="memory-footer"><span>Updated {memoryDate(memory.updatedAt)}</span><div className="memory-actions"><button className="icon-btn" type="button" onClick={() => removeMemory(memory)} disabled={isMutating} aria-label={`Remove ${memory.type} memory`} data-testid={`button-delete-memory-${memory.id}`}><Trash2 size={14} /></button></div></div>
                  </>
                )}
              </article>
            ))}
          </div>
        )}
      </main>
    </WorkspaceShell>
  );
}