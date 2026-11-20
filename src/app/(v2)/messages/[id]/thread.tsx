'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, RotateCcw } from 'lucide-react';
import { t } from '@/core/copy';
import { formatDate, formatTime } from '@/core/format';
import { Glass } from '@/components/v2/glass';
import { SnipLoader } from '@/components/v2/snip-loader';
import { api } from '@/lib/v2/api';
import { duration, ease } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface Msg {
  id: string;
  body: string;
  mine: boolean;
  createdAt: string;
  state?: 'sending' | 'failed';
}

const dayOf = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });

export function Thread({ id, initial, counterpart }: { id: string; initial: Msg[]; counterpart: string }) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [draft, setDraft] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const last = msgs.filter((m) => !m.state).at(-1)?.createdAt;

  // Keep the newest message in view.
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs.length]);

  // Poll for new messages every 4 seconds while the page is visible.
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (!stop && document.visibilityState === 'visible') {
        const q = last ? `?after=${encodeURIComponent(last)}` : '';
        const data = await api<{ messages: Msg[] }>(`/conversations/${id}/messages${q}`).catch(() => null);
        if (data?.messages.length && !stop) setMsgs((cur) => [...cur, ...data.messages.filter((m) => !cur.some((c) => c.id === m.id))]);
      }
      if (!stop) setTimeout(tick, 4000);
    };
    const timer = setTimeout(tick, 4000);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [id, last]);

  async function send(body: string, retryId?: string) {
    const temp: Msg = { id: retryId ?? `tmp-${crypto.randomUUID()}`, body, mine: true, createdAt: new Date().toISOString(), state: 'sending' };
    setMsgs((cur) => (retryId ? cur.map((m) => (m.id === retryId ? temp : m)) : [...cur, temp]));
    try {
      const { message } = await api<{ message: Msg }>(`/conversations/${id}/messages`, { body: { body } });
      setMsgs((cur) => cur.map((m) => (m.id === temp.id ? message : m)));
    } catch {
      setMsgs((cur) => cur.map((m) => (m.id === temp.id ? { ...m, state: 'failed' } : m)));
    }
  }

  return (
    <div className="pb-40">
      <ol className="space-y-1.5" aria-label={t('messages.threadLabel', { name: counterpart })} aria-live="polite">
        <AnimatePresence initial={false}>
          {msgs.map((m, i) => {
            const newDay = i === 0 || dayOf(m.createdAt) !== dayOf(msgs[i - 1].createdAt);
            return (
              <motion.li key={m.id} layout="position" initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: duration.base, ease: ease.standard }} style={{ originX: m.mine ? 1 : 0 }}>
                {newDay && <p className="py-3 text-center text-[13px] font-semibold text-muted-foreground">{formatDate(new Date(m.createdAt))}</p>}
                <div className={cn('flex', m.mine ? 'justify-end' : 'justify-start')}>
                  <button
                    type="button"
                    disabled={m.state !== 'failed'}
                    onClick={() => m.state === 'failed' && send(m.body, m.id)}
                    className={cn(
                      'max-w-[80%] rounded-3xl px-4 py-2.5 text-left text-[17px] leading-snug',
                      m.mine ? 'rounded-br-lg bg-foreground text-background' : 'rounded-bl-lg border border-[var(--hairline)] bg-[var(--surface-1)]',
                      m.state === 'failed' && 'opacity-60',
                    )}
                  >
                    <span className="whitespace-pre-wrap break-words">{m.body}</span>
                    <span className="mt-1 flex items-center justify-end gap-1.5 text-[12px] opacity-70 tabular-nums">
                      {m.state === 'sending' ? <SnipLoader size={14} label={t('messages.sending')} /> : m.state === 'failed' ? <RotateCcw className="size-3.5" aria-hidden /> : null}
                      {m.state === 'failed' ? t('messages.failed') : formatTime(new Date(m.createdAt))}
                    </span>
                  </button>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
      <div ref={bottom} />
      {/* Composer: functional layer, regular glass; the send button is a fill, not glass. */}
      <form
        className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 md:bottom-6"
        onSubmit={(e) => {
          e.preventDefault();
          const body = draft.trim();
          if (!body) return;
          setDraft('');
          void send(body);
        }}
      >
        <Glass className="flex w-full max-w-2xl items-end gap-2 rounded-[28px] p-2 pl-5">
          <label htmlFor="composer" className="sr-only">
            {t('messages.placeholder', { name: counterpart })}
          </label>
          <textarea
            id="composer"
            rows={1}
            value={draft}
            maxLength={2000}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={t('messages.placeholder', { name: counterpart })}
            className="max-h-36 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-[17px] outline-none placeholder:text-foreground/70 [field-sizing:content]"
          />
          <motion.button
            type="submit"
            aria-label={t('actions.send')}
            disabled={!draft.trim()}
            whileTap={{ scale: 0.92 }}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-[image:var(--styra-gradient)] text-primary-foreground transition-opacity disabled:opacity-40"
          >
            <ArrowUp className="size-5" strokeWidth={2.5} />
          </motion.button>
        </Glass>
      </form>
    </div>
  );
}
