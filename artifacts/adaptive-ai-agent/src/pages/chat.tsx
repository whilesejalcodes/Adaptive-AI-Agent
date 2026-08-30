import { ArrowUp, Check, Clock3, FileText, History, MoreHorizontal, Pencil, Plus, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { Children, FormEvent, isValidElement, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListConversationFeedbackQueryKey,
  getListConversationMessagesQueryKey,
  getListConversationsQueryKey,
  useCreateConversation,
  useListConversationMessages,
  useListConversations,
  useListConversationFeedback,
  useSendConversationMessage,
  useSubmitMessageFeedback,
  useUpdateConversation,
  type Conversation,
  type Feedback,
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
  const cleanText = text.trim();
  const firstThought = cleanText.split(/[.!?\n]/)[0]?.trim() || cleanText;
  const shortened = firstThought.slice(0, 48).trimEnd();
  return shortened.length < firstThought.length ? `${shortened}…` : shortened;
}

function initials(value: string): string {
  return value.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function MarkdownPre({ children }: { children?: ReactNode }) {
  const firstChild = Children.toArray(children)[0];
  const codeClassName = isValidElement(firstChild)
    ? (firstChild as ReactElement<{ className?: string }>).props.className
    : undefined;
  const language = codeClassName?.match(/language-([\w+-]+)/)?.[1];

  return (
    <div className="markdown-code-block">
      <div className="markdown-code-label">{language ?? 'code'}</div>
      <pre>{children}</pre>
    </div>
  );
}

function MarkdownResponse({ text }: { text: string }) {
  return (
    <div className="message-markdown">
      <ReactMarkdown
        components={{
          pre: MarkdownPre,
          code: ({ className, children, ...props }) => {
            const inline = !className && !String(children).includes('\n');
            return <code className={className} data-inline={inline || undefined} {...props}>{children}</code>;
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function Message({
  message,
  userInitials,
  onFeedback,
  feedback,
  feedbackPending,
  feedbackDisabled,
  feedbackSaved,
  feedbackError,
}: {
  message: ApiMessage;
  userInitials: string;
  onFeedback: (id: string, value: Feedback['rating']) => void;
  feedback: Feedback['rating'] | null;
  feedbackPending: boolean;
  feedbackDisabled: boolean;
  feedbackSaved: boolean;
  feedbackError: boolean;
}) {
  const isUser = message.role === 'user';

  return (
    <article className={`message ${isUser ? 'user' : ''}`} data-testid={`message-${message.id}`}>
      <div className="message-avatar" aria-hidden="true">{isUser ? userInitials : 'a/'}</div>
      <div className="message-content">
        <div className="message-meta">{isUser ? 'you' : 'adaptive'} · {messageTime(message.timestamp)}</div>
        <div className="message-bubble">{isUser ? message.text : <MarkdownResponse text={message.text} />}</div>
        {!isUser && (
          <div className="mt-2 flex min-h-8 items-center gap-1">
            <button
              className={`icon-btn ${feedback === 'up' ? 'text-[hsl(var(--primary))]' : ''}`}
              type="button"
              onClick={() => onFeedback(message.id, 'up')}
              aria-label="Helpful response"
              aria-pressed={feedback === 'up'}
              disabled={feedbackDisabled}
              data-testid={`button-feedback-up-${message.id}`}
            >
              <ThumbsUp size={13} />
            </button>
            <button
              className={`icon-btn ${feedback === 'down' ? 'text-[hsl(var(--primary))]' : ''}`}
              type="button"
              onClick={() => onFeedback(message.id, 'down')}
              aria-label="Unhelpful response"
              aria-pressed={feedback === 'down'}
              disabled={feedbackDisabled}
              data-testid={`button-feedback-down-${message.id}`}
            >
              <ThumbsDown size={13} />
            </button>
            <span
              className={`ml-1 text-[10px] ${feedbackError ? 'text-[hsl(var(--destructive))]' : 'text-[hsl(var(--muted-foreground))]'}`}
              role={feedbackError ? 'alert' : feedbackSaved || feedbackPending ? 'status' : undefined}
            >
              {feedbackPending ? 'Saving…' : feedbackError ? 'Could not save' : feedbackSaved ? 'Saved' : ''}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}

function MobileConversationHistory({
  conversations,
  selectedConversationId,
  isLoading,
  onChoose,
  onNewThought,
  close,
}: {
  conversations: Conversation[];
  selectedConversationId: string | null | undefined;
  isLoading: boolean;
  onChoose: (id: string) => void;
  onNewThought: () => void;
  close: () => void;
}) {
  return (
    <div className="mobile-history" aria-labelledby="mobile-history-title">
      <div className="mobile-history-heading">
        <div>
          <div className="eyebrow rail-caption">Your threads</div>
          <h2 id="mobile-history-title">Conversation history</h2>
        </div>
        <button className="btn btn-ghost btn-small" type="button" onClick={() => { onNewThought(); close(); }} data-testid="button-mobile-new-thought">
          <Plus size={13} /> New
        </button>
      </div>
      {isLoading ? (
        <p className="mobile-history-empty" role="status">Loading your conversations…</p>
      ) : conversations.length === 0 ? (
        <p className="mobile-history-empty">Your saved conversations will appear here.</p>
      ) : (
        <div className="mobile-history-list">
          {conversations.map((item) => (
            <button
              key={item.id}
              className={`mobile-history-item ${selectedConversationId === item.id ? 'active' : ''}`}
              type="button"
              onClick={() => { onChoose(item.id); close(); }}
              title={item.title}
              data-testid={`button-mobile-history-${item.id}`}
            >
              <span className="history-item-title">{item.title}</span>
              <span className="history-item-meta"><Clock3 size={10} /> {conversationDate(item.updatedAt)}</span>
            </button>
          ))}
        </div>
      )}
      <button className="mobile-history-return" type="button" onClick={close} data-testid="button-mobile-return-chat">
        Return to current chat <ArrowUp size={13} className="rotate-45" />
      </button>
    </div>
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
        retry: 1,
    },
  });
  const messagesQuery = useListConversationMessages(selectedConversationId ?? '', {
    query: {
      queryKey: getListConversationMessagesQueryKey(selectedConversationId ?? ''),
      enabled: typeof selectedConversationId === 'string',
        retry: 1,
    },
  });
  const feedbackQuery = useListConversationFeedback(selectedConversationId ?? '', {
    query: {
      queryKey: getListConversationFeedbackQueryKey(selectedConversationId ?? ''),
      enabled: typeof selectedConversationId === 'string',
        retry: 1,
    },
  });
  const createConversationMutation = useCreateConversation();
  const sendMessageMutation = useSendConversationMessage();
  const submitFeedbackMutation = useSubmitMessageFeedback();
  const updateConversationMutation = useUpdateConversation();
  const conversations = conversationsQuery.data ?? [];
  const messages = messagesQuery.data ?? [];
  const feedback = feedbackQuery.data ?? [];
  const selectedConversation = conversations.find((item) => item.id === selectedConversationId);
  const isThinking = createConversationMutation.isPending || sendMessageMutation.isPending;
  const displayName = user?.displayName || user?.email || 'You';
  const userInitials = initials(displayName);
  const [feedbackPendingMessageId, setFeedbackPendingMessageId] = useState<string | null>(null);
  const [feedbackSavedMessageId, setFeedbackSavedMessageId] = useState<string | null>(null);
  const [feedbackErrorMessageId, setFeedbackErrorMessageId] = useState<string | null>(null);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [conversationTitleDraft, setConversationTitleDraft] = useState('');
  const [conversationTitleError, setConversationTitleError] = useState('');

  useEffect(() => {
    if (selectedConversationId !== undefined || !conversationsQuery.isFetched) return;
    setSelectedConversationId(conversationsQuery.data?.[0]?.id ?? null);
  }, [conversationsQuery.data, conversationsQuery.isFetched, selectedConversationId]);

  useEffect(() => {
    setFeedbackPendingMessageId(null);
    setFeedbackSavedMessageId(null);
    setFeedbackErrorMessageId(null);
  }, [selectedConversationId]);

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
    setEditingConversationId(null);
    setConversationTitleError('');
  }

  function chooseConversation(id: string) {
    setSelectedConversationId(id);
    setNotice('');
    setEditingConversationId(null);
    setConversationTitleError('');
  }

  function beginConversationTitleEdit() {
    if (!selectedConversation) return;
    setEditingConversationId(selectedConversation.id);
    setConversationTitleDraft(selectedConversation.title);
    setConversationTitleError('');
    setNotice('');
  }

  function cancelConversationTitleEdit() {
    setEditingConversationId(null);
    setConversationTitleDraft('');
    setConversationTitleError('');
  }

  async function saveConversationTitle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedConversation || editingConversationId !== selectedConversation.id) return;
    const title = conversationTitleDraft.trim();
    if (!title) {
      setConversationTitleError('Add a title before saving.');
      return;
    }
    if (title.length > 120) {
      setConversationTitleError('Titles must be 120 characters or fewer.');
      return;
    }

    setConversationTitleError('');
    try {
      const updatedConversation = await updateConversationMutation.mutateAsync({
        conversationId: selectedConversation.id,
        data: { title },
      });
      queryClient.setQueryData<Conversation[]>(
        getListConversationsQueryKey(),
        (current = []) => current.map((conversation) =>
          conversation.id === updatedConversation.id ? updatedConversation : conversation),
      );
      cancelConversationTitleEdit();
      setNotice('Conversation title updated.');
    } catch (error) {
      setConversationTitleError(error instanceof Error ? error.message : 'The conversation title could not be saved.');
    }
  }

  async function retryChatQueries() {
    try {
      const results = await Promise.all([
        ...(conversationsQuery.isError ? [conversationsQuery.refetch()] : []),
        ...(messagesQuery.isError ? [messagesQuery.refetch()] : []),
      ]);
      if (results.some((result) => result.isError)) {
        setNotice('The conversation is still unavailable. Please try again in a moment.');
      }
    } catch {
      setNotice('The conversation is still unavailable. Please try again in a moment.');
    }
  }

  async function retryFeedback() {
    try {
      const result = await feedbackQuery.refetch();
      if (result.isError) {
        setNotice('Feedback is still unavailable. Please try again in a moment.');
      }
    } catch {
      setNotice('Feedback is still unavailable. Please try again in a moment.');
    }
  }

  async function handleFeedback(messageId: string, rating: Feedback['rating']) {
    const conversationId = selectedConversationId;
    if (!conversationId || feedbackPendingMessageId) return;

    setFeedbackPendingMessageId(messageId);
    setFeedbackSavedMessageId(null);
    setFeedbackErrorMessageId(null);
    try {
      const savedFeedback = await submitFeedbackMutation.mutateAsync({
        conversationId,
        messageId,
        data: { rating },
      });
      queryClient.setQueryData<Feedback[]>(
        getListConversationFeedbackQueryKey(conversationId),
        (current = []) => [
          ...current.filter((item) => item.messageId !== savedFeedback.messageId),
          savedFeedback,
        ],
      );
      setFeedbackSavedMessageId(messageId);
    } catch {
      setFeedbackErrorMessageId(messageId);
    } finally {
      setFeedbackPendingMessageId(null);
    }
  }

  const feedbackByMessageId = new Map(feedback.map((item) => [item.messageId, item.rating]));

  return (
    <WorkspaceShell
      mobilePanel={(close) => (
        <MobileConversationHistory
          conversations={conversations}
          selectedConversationId={selectedConversationId}
          isLoading={conversationsQuery.isLoading}
          onChoose={chooseConversation}
          onNewThought={startNewThought}
          close={close}
        />
      )}
    >
      <div className="topbar">
        <div className="connection opacity-0" aria-hidden="true"><span>placeholder</span></div>
        <button className="icon-btn" type="button" onClick={() => setNotice('Additional conversation actions are planned for a later phase.')} aria-label="More conversation actions" data-testid="button-chat-actions"><MoreHorizontal size={18} /></button>
      </div>
      <main className="chat-layout">
        <section className="chat-column">
          <div className="chat-header">
            <div>
              <div className="eyebrow muted">Conversation / {selectedConversationId ? conversations.findIndex((item) => item.id === selectedConversationId) + 1 : 'new'}</div>
              {editingConversationId === selectedConversation?.id ? (
                <form className="conversation-title-form" onSubmit={saveConversationTitle} data-testid="form-edit-conversation-title">
                  <div className="conversation-title-input-row">
                    <input
                      value={conversationTitleDraft}
                      onChange={(event) => setConversationTitleDraft(event.target.value)}
                      maxLength={120}
                      autoFocus
                      aria-label="Conversation title"
                      aria-invalid={Boolean(conversationTitleError)}
                      data-testid="input-conversation-title"
                    />
                    <button className="icon-btn" type="submit" disabled={updateConversationMutation.isPending} aria-label="Save conversation title" data-testid="button-save-conversation-title">
                      <Check size={15} />
                    </button>
                    <button className="icon-btn" type="button" onClick={cancelConversationTitleEdit} disabled={updateConversationMutation.isPending} aria-label="Cancel conversation title edit" data-testid="button-cancel-conversation-title">
                      <X size={15} />
                    </button>
                  </div>
                  <div className={`conversation-title-helper ${conversationTitleError ? 'error' : ''}`} role={conversationTitleError ? 'alert' : undefined}>
                    {conversationTitleError || `${conversationTitleDraft.length}/120 characters`}
                  </div>
                </form>
              ) : (
                <div className="chat-title-row">
                  <h1 className="display">{selectedConversation?.title ?? 'A new thought'}</h1>
                  {selectedConversation && (
                    <button className="icon-btn chat-title-edit" type="button" onClick={beginConversationTitleEdit} aria-label="Edit conversation title" data-testid="button-edit-conversation-title">
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
              )}
              <p>Useful context, without the noise.</p>
            </div>
            <button className="btn btn-ghost btn-small" type="button" onClick={startNewThought} data-testid="button-new-thought"><Plus size={14} /> New thought</button>
          </div>
          {notice && <div className="notice" role="status" data-testid="status-chat-notice"><Sparkles size={15} /><span>{notice}</span><button className="icon-btn ml-auto" type="button" onClick={() => setNotice('')} aria-label="Dismiss notice" data-testid="button-dismiss-chat-notice"><X size={14} /></button></div>}
          {(conversationsQuery.isError || messagesQuery.isError) && (
            <div className="notice border-[hsl(var(--destructive)/.35)] text-[hsl(var(--destructive))]" role="alert" data-testid="status-chat-error">
              <Sparkles size={15} /><span>We could not load this conversation. Sign in again if your session has expired.</span><button className="btn btn-link btn-small ml-auto" type="button" onClick={retryChatQueries} data-testid="button-retry-chat">Retry</button>
            </div>
          )}
          {feedbackQuery.isError && (
            <div className="notice border-[hsl(var(--destructive)/.35)] text-[hsl(var(--destructive))]" role="alert" data-testid="status-feedback-load-error">
              <Sparkles size={15} /><span>Feedback could not be loaded. You can try again later.</span><button className="btn btn-link btn-small ml-auto" type="button" onClick={retryFeedback} data-testid="button-retry-feedback">Retry</button>
            </div>
          )}
          {messages.length === 0 && !isThinking ? (
            <div className="card memory-empty my-8" data-testid="empty-chat">
              <Sparkles size={24} /><h2>{conversationsQuery.isLoading ? 'Loading your conversations…' : 'Start with what’s on your mind.'}</h2><p>There is no wrong place to begin. The thread gets more useful as you return to it.</p>
              {!conversationsQuery.isLoading && <button className="btn btn-primary btn-small mx-auto mt-5" type="button" onClick={() => setDraft('What should I pay attention to today?')} data-testid="button-suggest-first-message">Try a prompt</button>}
            </div>
          ) : (
            <div className="conversation-list" aria-live="polite">
               {messages.map((message) => (
                 <Message
                   key={message.id}
                   message={message}
                   userInitials={userInitials}
                   onFeedback={handleFeedback}
                   feedback={feedbackByMessageId.get(message.id) ?? null}
                   feedbackPending={feedbackPendingMessageId === message.id}
                   feedbackDisabled={feedbackPendingMessageId !== null}
                   feedbackSaved={feedbackSavedMessageId === message.id}
                   feedbackError={feedbackErrorMessageId === message.id}
                 />
               ))}
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
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' || event.shiftKey) return;
                  event.preventDefault();
                  if (!draft.trim() || isThinking) return;
                  event.currentTarget.form?.requestSubmit();
                }}
                placeholder="Write into the thread…"
                aria-label="Message adaptive"
                rows={1}
                maxLength={4000}
                data-testid="input-message"
              />
              <button className="send-btn" type="submit" disabled={!draft.trim() || isThinking} aria-label="Send message" data-testid="button-send-message"><ArrowUp size={17} /></button>
            </form>
            <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-[hsl(var(--muted-foreground))]"><span>Gemini responds using this conversation as context.</span><span className="font-mono">return ↵</span></div>
          </div>
        </section>
        <aside className="chat-side">
          <div className="card side-card conversation-history-card">
            <h3 className="flex items-center gap-2"><History size={13} /> Conversation history</h3>
            <div className="conversation-history-list">
              {conversations.length === 0 && !conversationsQuery.isLoading && <p className="px-2 py-3 text-[11px] text-[hsl(var(--muted-foreground))]">Your saved conversations will appear here.</p>}
              {conversations.map((item) => (
                <button key={item.id} className={`history-item ${selectedConversationId === item.id ? 'active' : ''}`} type="button" onClick={() => chooseConversation(item.id)} title={item.title} data-testid={`button-history-${item.id}`}>
                  <span className="history-item-title">{item.title}</span><span className="history-item-meta"><Clock3 size={10} /> {conversationDate(item.updatedAt)}</span>
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