import { Search } from 'lucide-react';
import { t } from '@/core/copy';
import { Glass } from './glass';

/** Search is a functional control, so it floats as glass (regular: it holds text). Plain GET form, works without JS. */
export function SearchCapsule({ defaultValue }: { defaultValue?: string }) {
  return (
    <form action="/explore" role="search">
      <Glass className="flex h-14 items-center gap-3 rounded-full pl-5 pr-2">
        <Search aria-hidden className="size-5 shrink-0" />
        <label htmlFor="q" className="sr-only">
          {t('browse.searchLabel')}
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={defaultValue}
          placeholder={t('browse.searchPlaceholder')}
          className="h-full min-w-0 flex-1 bg-transparent text-[17px] text-foreground outline-none placeholder:text-foreground/70"
        />
      </Glass>
    </form>
  );
}
