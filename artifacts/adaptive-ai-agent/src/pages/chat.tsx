import { ArrowUp, Clock3, FileText, History, MoreHorizontal, Plus, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link } from 'wouter';
import { WorkspaceShell } from '@/components/workspace-shell';

type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string; time: string };

const starterMessages: ChatMessage[] = [
  { id: 'm-1', role: 'user', text: 'I want to make my mornings feel less reactive. What could I try this week?', time: '09:14' },
  { id: 'm-2', role: 'assistant', text: 'A small experiment: keep the first 20 minutes deliberately input-free. Put your phone in another room, make tea, and write down the one thing you want to feel by noon. We can check back on Friday and see what changed.', time: '09:14' },
  { id: 'm-3', role: 'user', text: 'I like that. I have a hard time keeping routines when they get too rigid.', time: '09:16' },
  { id: 'm-4', role: 'assistant', text: 'Then let’s make it a direction, not a schedule. Your only anchor is “before the first scroll.” Everything else can flex. I’ll remember that you prefer adaptable rituals over strict routines.', time: '09:16' },
];

const history = [
  { id: 'h-1', title: 'A gentler morning', date: 'Today', active: true },
  { id: 'h-2', title: 'Planning the next season', date: 'Yesterday' },
  { id: 'h-3', title: 'The book I keep avoiding', date: 'Mar 18' },
  { id: 'h-4', title: 'Notes from a long walk', date: 'Mar 15' },
];

function Message({ message, onFeedback }: { message: ChatMessage; onFeedback: (id: string, value: 'up' | 'down') => void }) {
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const isUser = message.role === 'user';
  function feedbackClick(value: 'up' | 'down') {
    setFeedback(value);
    onFeedback(message.id, value);
  }
  return (
    <article className={`message ${isUser ? 'user' : ''}`} data-testid={`message-${message.id}`}>
      <div className="message-avatar" aria-hidden="true">{isUser ? 'SC' : 'a/'}</div>
      <div className="message-content">
        <div className="message-meta">{isUser ? 'you' : 'adaptive'} · {message.time}</div>
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
  const [messages, setMessages] = useState(starterMessages);
  const [draft, setDraft] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState('h-1');
  const [notice, setNotice] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanDraft = draft.trim();
    if (!cleanDraft || isThinking) return;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: 'user', text: cleanDraft, time: now }]);
    setDraft('');
    setIsThinking(true);
    window.setTimeout(() => {
      setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: 'assistant', text: 'I’m holding that thought. In the full workspace, this is where a response shaped by your saved context will arrive.', time: now }]);
      setIsThinking(false);
    }, 750);
  }

  function startNewThought() {
    setMessages([]);
    setSelectedConversation('');
    setNotice('New thought started. Nothing has been saved yet.');
  }

  function chooseConversation(id: string) {
    setSelectedConversation(id);
    setNotice(id === 'h-1' ? '' : 'Conversation history is a visual preview in Phase 1.');
    if (id !== 'h-1') setMessages([]);
    else setMessages(starterMessages);
  }

  return (
    <WorkspaceShell>
      <div className="topbar">
        <div className="connection opacity-0" aria-hidden="true"><span>placeholder</span></div>
        <button className="icon-btn" type="button" onClick={() => setNotice('Conversation actions will arrive with the saved workspace.')} aria-label="More conversation actions" data-testid="button-chat-actions"><MoreHorizontal size={18} /></button>
      </div>
      <main className="chat-layout">
        <section className="chat-column">
          <div className="chat-header">
            <div>
              <div className="eyebrow muted">Conversation / {selectedConversation ? '01' : 'new'}</div>
              <h1 className="display">{selectedConversation ? 'A gentler morning' : 'A new thought'}</h1>
              <p>Useful context, without the noise.</p>
            </div>
            <button className="btn btn-ghost btn-small" type="button" onClick={startNewThought} data-testid="button-new-thought"><Plus size={14} /> New thought</button>
          </div>
          {notice && <div className="notice" role="status" data-testid="status-chat-notice"><Sparkles size={15} /><span>{notice}</span><button className="icon-btn ml-auto" type="button" onClick={() => setNotice('')} aria-label="Dismiss notice" data-testid="button-dismiss-chat-notice"><X size={14} /></button></div>}
          {messages.length === 0 && !isThinking ? (
            <div className="card memory-empty my-8" data-testid="empty-chat">
              <Sparkles size={24} /><h2>Start with what’s on your mind.</h2><p>There is no wrong place to begin. The thread gets more useful as you return to it.</p>
              <button className="btn btn-primary btn-small mx-auto mt-5" type="button" onClick={() => setDraft('What should I pay attention to today?')} data-testid="button-suggest-first-message">Try a prompt</button>
            </div>
          ) : (
            <div className="conversation-list" aria-live="polite">
              {messages.map((message) => <Message key={message.id} message={message} onFeedback={() => setNotice('Thanks — this helps shape the future workspace.')} />)}
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
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write into the thread…" aria-label="Message adaptive" rows={1} data-testid="input-message" />
              <button className="send-btn" type="submit" disabled={!draft.trim() || isThinking} aria-label="Send message" data-testid="button-send-message"><ArrowUp size={17} /></button>
            </form>
            <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-[hsl(var(--muted-foreground))]"><span>Adaptive is a thinking partner, not an answer machine.</span><span className="font-mono">return ↵</span></div>
          </div>
        </section>
        <aside className="chat-side">
          <div className="card side-card">
            <h3 className="flex items-center gap-2"><History size={13} /> Conversation history</h3>
            <div className="grid gap-1">
              {history.map((item) => (
                <button key={item.id} className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${selectedConversation === item.id ? 'border-[hsl(var(--primary)/.35)] bg-[hsl(var(--primary)/.07)]' : 'border-transparent hover:bg-[hsl(var(--muted))]'}`} type="button" onClick={() => chooseConversation(item.id)} data-testid={`button-history-${item.id}`}>
                  <div className="truncate text-[12px] font-semibold">{item.title}</div><div className="mt-1 flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))]"><Clock3 size={10} /> {item.date}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="card side-card">
            <h3 className="flex items-center gap-2"><BrainIcon /> Held in context</h3>
            <div className="memory-mini"><span>01</span><p>You prefer adaptable rituals over rigid routines.</p></div>
            <div className="memory-mini"><span>02</span><p>You’re experimenting with input-free mornings.</p></div>
            <Link href="/memories" className="btn btn-link btn-small mt-2" data-testid="link-view-memories">Inspect memory <ArrowUp size={13} className="rotate-45" /></Link>
          </div>
          <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-4 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]"><FileText size={15} className="mb-2 text-[hsl(var(--primary))]" />Memory is inspectable by design. You decide what stays.</div>
        </aside>
      </main>
    </WorkspaceShell>
  );
}

function BrainIcon() {
  return <span className="grid h-4 w-4 place-items-center rounded bg-[hsl(var(--accent)/.35)] font-mono text-[8px] text-[hsl(var(--primary))]">a/</span>;
}