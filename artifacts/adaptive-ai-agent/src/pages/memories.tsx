import {
  Archive,
  Brain,
  Check,
  ChevronRight,
  Edit3,
  Info,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListMemoriesQueryKey,
  useCreateMemory,
  useDeleteMemory,
  useListMemories,
  useUpdateMemory,
  type Memory,
  type MemoryIndexStatus,
  type MemoryType,
} from '@workspace/api-client-react';
import { WorkspaceShell } from '@/components/workspace-shell';
import { useAuth } from '@/components/auth-provider';

const memoryTypes: MemoryType[] = ['preference', 'interest', 'goal', 'fact', 'instruction', 'context'];

const memoryTypeLabels: Record<MemoryType, string> = {
  preference: 'Preference',
  interest: 'Interest',
  goal: 'Goal',
  fact: 'Fact',
  instruction: 'Instruction',
  context: 'Context',
};

const statusDetails: Record<MemoryIndexStatus, { label: string; copy: string; tone: string }> = {
  indexed: { label: 'Ready for recall', copy: 'This memory can inform future conversations.', tone: 'indexed' },
  pending: { label: 'Preparing for recall', copy: 'This memory is being prepared for future conversations.', tone: 'pending' },
  failed: { label: 'Needs attention', copy: 'Indexing did not finish, so this memory will not influence conversations yet.', tone: 'failed' },
};

function memoryDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function memoryTitle(text: string, type: MemoryType): string {
  const firstThought = text.split(/[.!?\n]/)[0]?.trim() || text.trim();
  const title = firstThought.length > 58 ? `${firstThought.slice(0, 58).trimEnd()}…` : firstThought;
  return title || `${memoryTypeLabels[type]} memory`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The memory operation could not be completed.';
}

type MemoryFormProps = {
  formId: string;
  initialText: string;
  initialType: MemoryType;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (text: string, type: MemoryType) => void;
  compact?: boolean;
};

function MemoryForm({ formId, initialText, initialType, isSaving, onCancel, onSave, compact = false }: MemoryFormProps) {
  const [text, setText] = useState(initialText);
  const [type, setType] = useState<MemoryType>(initialType);
  const trimmedText = text.trim();
  const textError = trimmedText.length > 0 && trimmedText.length < 3;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (trimmedText.length < 3 || isSaving) return;
    onSave(trimmedText, type);
  }

  return (
    <form className={`memory-form ${compact ? 'memory-form-compact' : ''}`} onSubmit={submit} data-testid={`form-${formId}`}>
      <div className="memory-form-heading">
        <div>
          <div className="eyebrow text-[hsl(var(--primary))]">{compact ? 'Refine context' : 'New context'}</div>
          <h2 className="section-heading">{compact ? 'Edit this memory' : 'Add a memory'}</h2>
        </div>
        <button className="icon-btn" type="button" onClick={onCancel} aria-label={compact ? 'Cancel editing memory' : 'Close add memory form'} data-testid={compact ? `button-close-edit-memory-${formId}` : 'button-close-create-memory'}>
          <X size={16} />
        </button>
      </div>
      <div className="memory-form-fields">
        <div className="field">
          <label htmlFor={`${formId}-type`}>Category</label>
          <select id={`${formId}-type`} value={type} onChange={(event) => setType(event.target.value as MemoryType)} data-testid={compact ? `select-edit-memory-type-${formId}` : 'select-memory-type'}>
            {memoryTypes.map((memoryType) => <option key={memoryType} value={memoryType}>{memoryTypeLabels[memoryType]}</option>)}
          </select>
        </div>
        <div className="field memory-form-text">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor={`${formId}-content`}>{compact ? 'Memory content' : 'What should adaptive remember?'}</label>
            <span className="field-count">{text.length}/500</span>
          </div>
          <textarea
            id={`${formId}-content`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Write it in your own words…"
            maxLength={500}
            aria-invalid={textError}
            aria-describedby={textError ? `${formId}-error` : undefined}
            data-testid={compact ? `input-edit-memory-content-${formId}` : 'input-memory-content'}
            required
          />
          {textError && <span className="field-error" id={`${formId}-error`}>Add at least 3 characters.</span>}
        </div>
      </div>
      <div className="memory-form-footer">
        <span className="muted memory-form-hint">{compact ? 'Saving will prepare it for recall again.' : 'You can edit or remove this later.'}</span>
        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost btn-small" type="button" onClick={onCancel} data-testid={compact ? `button-cancel-edit-${formId}` : 'button-cancel-create-memory'}>Cancel</button>
          <button className="btn btn-primary btn-small" type="submit" disabled={isSaving || trimmedText.length < 3} data-testid={compact ? `button-save-edit-${formId}` : 'button-save-memory'}>
            <Check size={13} />
            {isSaving ? 'Saving…' : compact ? 'Save changes' : 'Save memory'}
          </button>
        </div>
      </div>
    </form>
  );
}

function MemoryStatus({ status }: { status: MemoryIndexStatus }) {
  const details = statusDetails[status];
  return (
    <div className={`memory-status ${details.tone}`} title={details.copy} aria-label={`${details.label}. ${details.copy}`} data-testid={`status-memory-index-${status}`}>
      <span className="memory-status-main"><span className="memory-status-dot" aria-hidden="true" />{details.label}</span>
      <span className="memory-status-copy">{details.copy}</span>
    </div>
  );
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
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const memories = memoriesQuery.data ?? [];
  const filtered = useMemo(
    () => {
      const normalizedQuery = query.trim().toLowerCase();
      if (!normalizedQuery) return memories;
      return memories.filter((memory) => {
        const title = memoryTitle(memory.text, memory.type);
        return `${memory.type} ${memoryTypeLabels[memory.type]} ${title} ${memory.text}`.toLowerCase().includes(normalizedQuery);
      });
    },
    [memories, query],
  );
  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const indexedCount = memories.filter((memory) => memory.vectorStatus === 'indexed').length;

  function beginEdit(memory: Memory) {
    setShowCreate(false);
    setEditing(memory.id);
    setNotice(null);
  }

  async function refreshMemories() {
    await memoriesQuery.refetch();
  }

  async function saveEdit(id: string, text: string, type: MemoryType) {
    if (text.trim().length < 3 || isMutating) return;
    try {
      const updatedMemory = await updateMutation.mutateAsync({
        memoryId: id,
        data: { text: text.trim(), type },
      });
      queryClient.setQueryData<Memory[]>(getListMemoriesQueryKey(), (current) =>
        (current ?? []).map((memory) => memory.id === id ? updatedMemory : memory));
      setEditing(null);
      setNotice({ tone: 'success', text: 'Memory updated. It is being prepared for recall again.' });
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) });
    }
  }

  async function removeMemory(memory: Memory) {
    if (isMutating) return;
    try {
      await deleteMutation.mutateAsync({ memoryId: memory.id });
      queryClient.setQueryData<Memory[]>(getListMemoriesQueryKey(), (current) =>
        (current ?? []).filter((item) => item.id !== memory.id));
      setPendingDelete(null);
      setEditing((current) => current === memory.id ? null : current);
      setNotice({ tone: 'success', text: 'Memory removed from long-term context.' });
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) });
    }
  }

  async function createMemory(text: string, type: MemoryType) {
    if (text.trim().length < 3 || isMutating) return;
    try {
      const createdMemory = await createMutation.mutateAsync({
        data: { text: text.trim(), type },
      });
      queryClient.setQueryData<Memory[]>(getListMemoriesQueryKey(), (current) => [createdMemory, ...(current ?? [])]);
      setShowCreate(false);
      setNotice({ tone: 'success', text: 'Memory saved. It is being prepared for recall.' });
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) });
    }
  }

  return (
    <WorkspaceShell>
      <div className="topbar">
        <div className="connection opacity-0" aria-hidden="true"><span>placeholder</span></div>
        <button className="icon-btn" type="button" onClick={() => setNotice({ tone: 'info', text: 'Only memories marked ready for recall can influence future conversations.' })} aria-label="About memory recall" data-testid="button-memory-settings"><Archive size={17} /></button>
      </div>
      <main className="workspace-content">
        <div className="memory-head">
          <div className="memory-intro">
            <div className="eyebrow text-[hsl(var(--primary))]">Your long-term context</div>
            <h1 className="display">Memory, in the open.</h1>
            <p>Small details that help future conversations meet you where you are. Review, refine, or remove them at any time.</p>
          </div>
          <div className="memory-head-actions">
            <div className="memory-total" aria-label={`${memories.length} total stored memories`} data-testid="text-memory-total">
              <strong>{memories.length.toString().padStart(2, '0')}</strong>
              <span>stored<br />memories</span>
            </div>
            <button className="btn btn-primary" type="button" onClick={() => { setShowCreate(true); setEditing(null); setNotice(null); }} data-testid="button-add-memory"><Plus size={15} /> Add memory</button>
          </div>
        </div>
        <div className="notice memory-explainer">
          <div className="notice-icon"><Info size={15} /></div>
          <div><strong>How memory shows up later</strong><span>When a memory is ready for recall, relevant parts can be added as separate context to Gemini’s response. They guide relevance, not priority, and never replace what you say now.</span></div>
          <span className="memory-index-summary">{indexedCount}/{memories.length || 0} ready</span>
        </div>
        {notice && (
          <div className={`memory-notice ${notice.tone}`} role="status" data-testid="status-memory-notice">
            {notice.tone === 'error' ? <Info size={14} /> : <Check size={14} />}
            <span>{notice.text}</span>
            <button className="icon-btn ml-auto" type="button" onClick={() => setNotice(null)} aria-label="Dismiss memory notice" data-testid="button-dismiss-memory-notice"><X size={14} /></button>
          </div>
        )}
        {showCreate && (
          <MemoryForm formId="create-memory" initialText="" initialType="context" isSaving={createMutation.isPending} onCancel={() => setShowCreate(false)} onSave={createMemory} />
        )}
        <div className="memory-tools">
          <div className="search-field"><Search size={15} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search content, title, or category" aria-label="Search memories by content, title, or category" data-testid="input-search-memories" />{query && <button className="search-clear" type="button" onClick={() => setQuery('')} aria-label="Clear memory search" data-testid="button-clear-memory-search"><X size={13} /></button>}</div>
          <span className="memory-result-count" data-testid="text-memory-count"><strong>{filtered.length.toString().padStart(2, '0')}</strong> of {memories.length} shown</span>
          <button className="btn btn-ghost btn-small memory-refresh" type="button" onClick={refreshMemories} disabled={memoriesQuery.isFetching} data-testid="button-refresh-memories"><RefreshCw size={13} className={memoriesQuery.isFetching ? 'refreshing' : ''} /> {memoriesQuery.isFetching ? 'Refreshing' : 'Refresh'}</button>
        </div>
        {memoriesQuery.isError && <div className="card memory-empty" role="alert" data-testid="error-memories"><Brain size={25} /><h2>Memories could not be loaded.</h2><p>Check your connection or sign in again, then retry.</p><button className="btn btn-ghost btn-small mx-auto mt-4" type="button" onClick={() => memoriesQuery.refetch()} data-testid="button-retry-memories">Retry</button></div>}
        {!memoriesQuery.isError && (
          <div className="memory-grid">
            {memoriesQuery.isLoading ? <MemoryLoadingState /> : filtered.length === 0 ? <div className="card memory-empty" data-testid="empty-memories"><Brain size={25} /><h2>{query ? 'No memories match that search.' : 'No memories yet.'}</h2><p>{query ? 'Try a wider phrase or category.' : 'Useful preferences, goals, and facts from conversations will appear here.'}</p>{query && <button className="btn btn-ghost btn-small mx-auto mt-4" type="button" onClick={() => setQuery('')} data-testid="button-clear-empty-memory-search">Clear search</button>}</div> : filtered.map((memory) => (
              <article className="card memory-card" key={memory.id} data-testid={`card-memory-${memory.id}`}>
                {editing === memory.id ? (
                   <MemoryForm formId={memory.id} initialText={memory.text} initialType={memory.type} isSaving={updateMutation.isPending} onCancel={() => setEditing(null)} onSave={(text, type) => saveEdit(memory.id, text, type)} compact />
                ) : (
                  <>
                     <div className="memory-top"><div className="memory-title-group"><div className="memory-kind">{memoryTypeLabels[memory.type]}</div><h2 data-testid={`text-memory-title-${memory.id}`}>{memoryTitle(memory.text, memory.type)}</h2></div><button className="icon-btn" type="button" onClick={() => beginEdit(memory)} aria-label={`Edit ${memoryTypeLabels[memory.type]} memory`} data-testid={`button-edit-memory-${memory.id}`}><Edit3 size={14} /></button></div>
                     <blockquote data-testid={`text-memory-content-${memory.id}`}>{memory.text}</blockquote>
                     <div className="memory-meta-row">
                       <MemoryStatus status={memory.vectorStatus} />
                       <span className="memory-origin">{memory.sourceConversationId === 'manual' ? 'Added by you' : 'From a conversation'}</span>
                     </div>
                     <div className="memory-dates">
                       <span>Created {memoryDate(memory.createdAt)}</span>
                       <span>Updated {memoryDate(memory.updatedAt)}</span>
                     </div>
                     {pendingDelete === memory.id ? (
                       <div className="delete-confirmation" role="alertdialog" aria-labelledby={`delete-title-${memory.id}`} aria-describedby={`delete-copy-${memory.id}`} data-testid={`confirm-delete-memory-${memory.id}`}>
                         <div><strong id={`delete-title-${memory.id}`}>Remove this memory?</strong><span id={`delete-copy-${memory.id}`}>It will no longer be available as long-term context.</span></div>
                         <div className="delete-confirmation-actions">
                           <button className="btn btn-ghost btn-small" type="button" onClick={() => setPendingDelete(null)} disabled={isMutating} data-testid={`button-cancel-delete-memory-${memory.id}`}>Keep it</button>
                           <button className="btn btn-danger btn-small" type="button" onClick={() => removeMemory(memory)} disabled={isMutating} data-testid={`button-confirm-delete-memory-${memory.id}`}><Trash2 size={13} /> {deleteMutation.isPending ? 'Removing…' : 'Remove'}</button>
                         </div>
                       </div>
                     ) : (
                       <div className="memory-footer"><span className="memory-footer-link">Long-term context <ChevronRight size={12} /></span><div className="memory-actions"><button className="icon-btn danger-hover" type="button" onClick={() => setPendingDelete(memory.id)} disabled={isMutating} aria-label={`Remove ${memoryTypeLabels[memory.type]} memory`} data-testid={`button-delete-memory-${memory.id}`}><Trash2 size={14} /></button></div></div>
                     )}
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

function MemoryLoadingState() {
  return (
    <div className="memory-loading-grid" data-testid="loading-memories" aria-label="Loading memories">
      {[0, 1, 2, 3].map((item) => (
        <div className="card memory-card memory-skeleton" key={item} aria-hidden="true">
          <div className="skeleton skeleton-kicker" />
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line short" />
          <div className="skeleton skeleton-footer" />
        </div>
      ))}
    </div>
  );
}