'use client';

import { useState, useCallback } from 'react';
import { Globe, Loader2, Check } from 'lucide-react';
import { useI18nStore } from '@/store/i18n-store';
import { SUPPORTED_LOCALES } from '@/i18n/config';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Locale } from '@/i18n/config';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface LanguageSwitcherProps {
  mode?: 'compact' | 'full';
  className?: string;
}

export function LanguageSwitcher({ mode, className }: LanguageSwitcherProps) {
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);
  const isLoading = useI18nStore((s) => s.isLoading);
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const effectiveMode = mode || (isMobile ? 'compact' : 'full');

  const currentConfig = SUPPORTED_LOCALES.find((l) => l.code === locale) || SUPPORTED_LOCALES[0];

  const handleSelect = useCallback(
    async (code: Locale) => {
      if (code === locale) {
        setOpen(false);
        return;
      }
      await setLocale(code);
      setOpen(false);
    },
    [locale, setLocale]
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Current language: ${currentConfig.name}. Change language.`}
          aria-expanded={open}
          className={cn(
            'relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
            'bg-white/10 dark:bg-slate-800/40 backdrop-blur-md',
            'border border-white/20 dark:border-slate-700/50',
            'text-slate-700 dark:text-slate-200',
            'hover:bg-white/20 dark:hover:bg-slate-700/40',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2',
            'transition-all duration-200 ease-in-out',
            effectiveMode === 'compact' && 'px-2 py-1.5',
            className
          )}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <span className="text-base leading-none">{currentConfig.flag}</span>
          )}
          {effectiveMode === 'full' && (
            <>
              <span className="hidden sm:inline">{currentConfig.nativeName}</span>
              <Globe className="h-3.5 w-3.5 opacity-60" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-48 glass-card"
      >
        {SUPPORTED_LOCALES.map((loc) => {
          const isSelected = loc.code === locale;
          return (
            <DropdownMenuItem
              key={loc.code}
              onSelect={() => handleSelect(loc.code)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 cursor-pointer',
                isSelected && 'bg-primary/10 font-medium'
              )}
            >
              <span className="text-lg leading-none">{loc.flag}</span>
              <div className="flex flex-col">
                <span className="text-sm">{loc.nativeName}</span>
                <span className="text-xs text-muted-foreground">{loc.name}</span>
              </div>
              {isSelected && (
                <Check className="ml-auto h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
