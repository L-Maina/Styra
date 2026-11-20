'use client';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ImagePlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { errorText, t } from '@/core/copy';
import { BusinessAvatar, BusinessCover } from '@/components/v2/business-media';
import { SnipLoader } from '@/components/v2/snip-loader';
import { Section } from '@/components/v2/ui';
import { duration, ease } from '@/lib/motion';

type Kind = 'LOGO' | 'COVER' | 'GALLERY';
interface Photo {
  id: string;
  kind: Kind;
  url: string;
  caption: string | null;
}

async function upload(kind: Kind, file: File): Promise<boolean> {
  const form = new FormData();
  form.set('kind', kind);
  form.set('file', file);
  try {
    const res = await fetch('/api/v2/pro/photos', { method: 'POST', body: form, credentials: 'same-origin' });
    const json = (await res.json()) as { ok: boolean; error?: { code: string; ref?: string } };
    if (!json.ok) {
      toast(errorText(json.error!.code, json.error!.ref ? { ref: json.error!.ref } : undefined));
      return false;
    }
    return true;
  } catch {
    toast(errorText('NETWORK'));
    return false;
  }
}

/** A tappable slot that opens the file picker; shows the snip loader on itself while uploading. */
function PickSlot({ kind, label, children, className }: { kind: Kind; label: string; children: React.ReactNode; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div className={`relative ${className ?? ''}`}>
      <button type="button" onClick={() => input.current?.click()} disabled={busy} aria-label={label} className="press block h-full w-full overflow-hidden rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {children}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setBusy(true);
          const ok = await upload(kind, file);
          setBusy(false);
          if (ok) {
            toast(t('toast.saved'));
            router.refresh();
          }
        }}
      />
      <AnimatePresence>
        {busy && (
          <motion.span className="absolute inset-0 grid place-items-center rounded-[inherit] bg-background/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: duration.fast }}>
            <SnipLoader size={36} />
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PhotoManager({ photos, business }: { photos: Photo[]; business: { name: string; category: string } }) {
  const router = useRouter();
  const [removing, setRemoving] = useState<string | null>(null);
  const logo = photos.find((p) => p.kind === 'LOGO');
  const cover = photos.find((p) => p.kind === 'COVER');
  const gallery = photos.filter((p) => p.kind === 'GALLERY');

  async function remove(id: string) {
    setRemoving(id);
    const res = await fetch(`/api/v2/pro/photos/${id}`, { method: 'DELETE', credentials: 'same-origin' }).then((r) => r.json()).catch(() => null);
    setRemoving(null);
    if (res?.ok) {
      toast(t('toast.saved'));
      router.refresh();
    } else toast(errorText(res?.error?.code ?? 'NETWORK'));
  }

  return (
    <div className="space-y-10">
      <div className="grid gap-6 sm:grid-cols-[160px_1fr]">
        <Section title={t('pro.logo')}>
          <PickSlot kind="LOGO" label={`${t('pro.replace')} ${t('pro.logo')}`} className="size-36 rounded-3xl">
            <BusinessAvatar name={business.name} category={business.category} logoUrl={logo?.url} className="size-36 rounded-3xl" />
          </PickSlot>
        </Section>
        <Section title={t('pro.cover')}>
          <PickSlot kind="COVER" label={`${t('pro.replace')} ${t('pro.cover')}`} className="aspect-[16/7] w-full rounded-3xl">
            <BusinessCover name={business.name} category={business.category} coverUrl={cover?.url} className="h-full w-full" sizes="(max-width: 640px) 100vw, 60vw" />
          </PickSlot>
        </Section>
      </div>
      <p className="text-[13px] text-muted-foreground">{t('pro.photoHint')}</p>
      <Section title={t('business.gallery')}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <AnimatePresence initial={false}>
            {gallery.map((p) => (
              <motion.li key={p.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: duration.base, ease: ease.standard }} className="group relative aspect-square overflow-hidden rounded-2xl bg-[var(--surface-2)]">
                <Image src={p.url} alt={p.caption ?? business.name} fill sizes="(max-width: 640px) 50vw, 25vw" className="object-cover" />
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  disabled={removing === p.id}
                  aria-label={t('pro.deletePhoto')}
                  className="absolute right-2 top-2 grid size-11 place-items-center rounded-full bg-background/80 text-foreground backdrop-blur-sm transition-opacity hover:bg-background"
                >
                  {removing === p.id ? <SnipLoader size={20} /> : <Trash2 className="size-5" />}
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
          {gallery.length < 24 && (
            <li className="aspect-square rounded-2xl">
              <PickSlot kind="GALLERY" label={t('pro.addPhoto')} className="h-full rounded-2xl">
                <span className="grid h-full place-items-center rounded-2xl border-2 border-dashed border-input text-[15px] font-semibold">
                  <span className="flex flex-col items-center gap-2">
                    <ImagePlus className="size-7" />
                    {t('pro.addPhoto')}
                  </span>
                </span>
              </PickSlot>
            </li>
          )}
        </ul>
      </Section>
    </div>
  );
}
