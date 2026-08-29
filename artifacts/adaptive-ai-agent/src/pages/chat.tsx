import { ArrowUp, Clock3, FileText, History, MoreHorizontal, Plus, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListConversationMessagesQueryKey,
  getListConversationsQueryKey,
  useCreateConversation,
  useListConversationMessages,
  useListConversations,
  useSendConversationMessage,
  type Message as ApiMessage,
} from '@workspace/api-client-react';
import { WorkspaceShell } from '@/components/workspace-shell';
import { useAuth } from '@/components/auth-provider';

function messageTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function conversationDate(timestamp: string): string {
  const date = new Date(timestamp);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function conversationTitle(text: string): string {
  const shortened = text.trim().slice(0, 56);
  return shortened.length < text.trim().length ? `${shortened}…` : shortened;
}

function initials(value: string): string {
  return value.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function Message({
  message,
  userInitials,
  onFeedback,
}: {
  message: ApiMessage;
  userInitials: string;
  onFeedback: (id: string, value: 'up' | 'down') => void;
}) {
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const isUser = message.role === 'user';

  function feedbackClick(value: 'up' | 'down') {
    setFeedback(value);
    onFeedback(message.id, value);
  }

  return (
    <article className={`message ${isUser ? 'user' : ''}`} data-testid={`message-${message.id}`}>
      <div className="message-avatar" aria-hidden="true">{isUser ? userInitials : 'a/'}</div>
      <div className="message-content">
        <div className="message-meta">{isUser ? 'you' : 'adaptive'} · {messageTime(message.timestamp)}</div>
        <div className="message-bubble">{message.text}</div>
        {!isUser && (
          <div className="mt-2 flex items-center gap-1">
            <button className={`icon-btn ${feedback === 'up' ? 'text-[hsl(var(--primary))]' : ''}`} type="button" onClick={() => feedbackClick('up')} aria-label="Helpful response" data-testid={`button-feedback-up-${message.id}`}><ThumbsUp size={13} /></button>
            <button className={`icon-btn ${feedback === 'down' ? 'text-[hsl(var(--primary))]' : ''}`} type="button" onClick={() => feedbackClick('down')} aria-label="Unhelpful response" data-testid={`button-feedback-down-${message.id}`}><ThumbsDown size={13} /></button>
          </div>
        )}
      </div>
    </article>
  );
}

export function ChatPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null | undefined>(undefined);
  const [notice, setNotice] = useState('');
  const conversationsQuery = useListConversations({
    query: {
      queryKey: getListConversationsQueryKey(),
      enabled: Boolean(user),
      retry: false,
    },
  });
  const messagesQuery = useListConversationMessages(selectedConversationId ?? '', {
    query: {
      queryKey: getListConversationMessagesQueryKey(selectedConversationId ?? ''),
      enabled: typeof selectedConversationId === 'string',
      retry: false,
    },
  });
  const createConversationMutation = useCreateConversation();
  const sendMessageMutation = useSendConversationMessage();
  const conversations = conversationsQuery.data ?? [];
  const messages = messagesQuery.data ?? [];
  const selectedConversation = conversations.find((item) => item.id === selectedConversationId);
  const isThinking = createConversationMutation.isPending || sendMessageMutation.isPending;
  const displayName = user?.displayName || user?.email || 'You';
  const userInitials = initials(displayName);

  useEffect(() => {
    if (selectedConversationId !== undefined || !conversationsQuery.isFetched) return;
    setSelectedConversationId(conversationsQuery.data?.[0]?.id ?? null);
  }, [conversationsQuery.data, conversationsQuery.isFetched, selectedConversationId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanDraft = draft.trim();
    if (!cleanDraft || isThinking) return;

    setDraft('');
    setNotice('');
    try {
      let conversationId = selectedConversationId;
      if (!conversationId) {
        const created = await createConversationMutation.mutateAsync({
          data: { title: conversationTitle(cleanDraft) },
        });
        conversationId = created.id;
        setSelectedConversationId(created.id);
        queryClient.setQueryData(getListConversationMessagesQueryKey(created.id), []);
      }

      const exchange = await sendMessageMutation.mutateAsync({
        conversationId,
        data: { text: cleanDraft },
      });
      queryClient.setQueryData<ApiMessage[]>(
        getListConversationMessagesQueryKey(conversationId),
        (current = []) => [...current, exchange.userMessage, exchange.assistantMessage],
      );
      await queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    } catch (error) {
      setDraft(cleanDraft);
      setNotice(error instanceof Error ? error.message : 'The message could not be saved. Please try again.');
    }
  }

  function startNewThought() {
    setSelectedConversationId(null);
    setDraft('');
    setNotice('This thought will be saved when you send its first message.');
  }

  function chooseConversation(id: string) {
    setSelectedConversationId(id);
    setNotice('');
  }

  return (
    <WorkspaceShell>
      <div className="topbar">
        <div className="connection opacity-0" aria-hidden="true"><span>placeholder</span></div>
        <button className="icon-btn" type="button" onClick={() => setNotice('Additional conversation actions are planned for a later phase.')} aria-label="More conversation actions" data-testid="button-chat-actions"><MoreHorizontal size={18} /></button>
      </div>
      <main className="chat-layout">
        <section className="chat-column">
          <div className="chat-header">
            <div>
              <div className="eyebrow muted">Conversation / {selectedConversationId ? conversations.findIndex((item) => item.id === selectedConversationId) + 1 : 'new'}</div>
              <h1 className="display">{selectedConversation?.title ?? 'A new thought'}</h1>
              <p>Useful context, without the noise.</p>
            </div>
            <button className="btn btn-ghost btn-small" type="button" onClick={startNewThought} data-testid="button-new-thought"><Plus size={14} /> New thought</button>
          </div>
          {notice && <div className="notice" role="status" data-testid="status-chat-notice"><Sparkles size={15} /><span>{notice}</span><button className="icon-btn ml-auto" type="button" onClick={() => setNotice('')} aria-label="Dismiss notice" data-testid="button-dismiss-chat-notice"><X size={14} /></button></div>}
          {(conversationsQuery.isError || messagesQuery.isError) && (
            <div className="notice border-[hsl(var(--destructive)/.35)] text-[hsl(var(--destructive))]" role="alert" data-testid="status-chat-error">
              <Sparkles size={15} /><span>We could not load this conversation. Sign in again if your session has expired.</span>
            </div>
          )}
          {messages.length === 0 && !isThinking ? (
            <div className="card memory-empty my-8" data-testid="empty-chat">
              <Sparkles size={24} /><h2>{conversationsQuery.isLoading ? 'Loading your conversations…' : 'Start with what’s on your mind.'}</h2><p>There is no wrong place to begin. The thread gets more useful as you return to it.</p>
              {!conversationsQuery.isLoading && <button className="btn btn-primary btn-small mx-auto mt-5" type="button" onClick={() => setDraft('What should I pay attention to today?')} data-testid="button-suggest-first-message">Try a prompt</button>}
            </div>
          ) : (
            <div className="conversation-list" aria-live="polite">
              {messages.map((message) => <Message key={message.id} message={message} userInitials={userInitials} onFeedback={() => setNotice('Thanks — feedback adaptation arrives in a later phase.')} />)}
              {isThinking && (
                <article className="message" data-testid="status-assistant-thinking">
                  <div className="message-avatar" aria-hidden="true">a/</div>
                  <div className="message-content"><div className="message-meta">adaptive · thinking</div><div className="message-bubble typing-bubble"><i /><i /><i /></div></div>
                </article>
              )}
            </div>
          )}
          <div className="composer-dock">
            <form className="composer" onSubmit={handleSubmit}>
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write into the thread…" aria-label="Message adaptive" rows={1} maxLength={4000} data-testid="input-message" />
              <button className="send-btn" type="submit" disabled={!draft.trim() || isThinking} aria-label="Send message" data-testid="button-send-message"><ArrowUp size={17} /></button>
            </form>
            <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-[hsl(var(--muted-foreground))]"><span>Gemini responds using this conversation as context.</span><span className="font-mono">return ↵</span></div>
          </div>
        </section>
        <aside className="chat-side">
          <div className="card side-card">
            <h3 className="flex items-center gap-2"><History size={13} /> Conversation history</h3>
            <div className="grid gap-1">
              {conversations.length === 0 && !conversationsQuery.isLoading && <p className="px-2 py-3 text-[11px] text-[hsl(var(--muted-foreground))]">Your saved conversations will appear here.</p>}
              {conversations.map((item) => (
                <button key={item.id} className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${selectedConversationId === item.id ? 'border-[hsl(var(--primary)/.35)] bg-[hsl(var(--primary)/.07)]' : 'border-transparent hover:bg-[hsl(var(--muted))]'}`} type="button" onClick={() => chooseConversation(item.id)} data-testid={`button-history-${item.id}`}>
                  <div className="truncate text-[12px] font-semibold">{item.title}</div><div className="mt-1 flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))]"><Clock3 size={10} /> {conversationDate(item.updatedAt)}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="card side-card">
            <h3 className="flex items-center gap-2"><BrainIcon /> Held in context</h3>
            <div className="memory-mini"><span>01</span><p>Relevant indexed memories can inform replies without overriding your current request.</p></div>
            <Link href="/memories" className="btn btn-link btn-small mt-2" data-testid="link-view-memories">Inspect your memories <ArrowUp size={13} className="rotate-45" /></Link>
          </div>
          <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-4 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]"><FileText size={15} className="mb-2 text-[hsl(var(--primary))]" />Memory-worthy details are stored after successful replies. Only relevant, owner-verified records are considered.</div>
        </aside>
      </main>
    </WorkspaceShell>
  );
}

function BrainIcon() {
  return <span className="grid h-4 w-4 place-items-center rounded bg-[hsl(var(--accent)/.35)] font-mono text-[8px] text-[hsl(var(--primary))]">a/</span>;
}