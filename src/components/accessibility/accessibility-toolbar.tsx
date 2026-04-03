'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useReducedMotion } from '@/components/ui/reduced-motion-provider';
import { announceToScreenReader } from '@/lib/accessibility';
import {
  Accessibility,
  Minus,
  Plus,
  RotateCcw,
  Eye,
  Moon,
  Volume2,
} from 'lucide-react';

const STORAGE_KEY = 'styra-a11y-settings';

interface A11ySettings {
  fontSize: number; // 80-150 as percentage
  highContrast: boolean;
  reducedMotion: boolean;
  screenReaderHints: boolean;
}

const DEFAULT_SETTINGS: A11ySettings = {
  fontSize: 100,
  highContrast: false,
  reducedMotion: false,
  screenReaderHints: true,
};

function saveSettings(settings: A11ySettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore
  }
}

export function AccessibilityToolbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<A11ySettings>(() => {
    // Lazy initializer: runs once on mount, no extra re-render
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          return JSON.parse(stored) as A11ySettings;
        }
      } catch { /* ignore */ }
    }
    return DEFAULT_SETTINGS;
  });
  const { prefersReducedMotion, setReducedMotion } = useReducedMotion();
  const mountedRef = useRef(false);

  // Derive effective settings using provider's reduced motion value
  const effectiveSettings = {
    ...settings,
    reducedMotion: prefersReducedMotion,
  };

  // Sync local reducedMotion setting to provider (in a useEffect, not during render)
  const prevReducedMotionRef = useRef(settings.reducedMotion);
  useEffect(() => {
    if (!mountedRef.current) return;
    if (prevReducedMotionRef.current !== settings.reducedMotion) {
      prevReducedMotionRef.current = settings.reducedMotion;
      setReducedMotion(settings.reducedMotion);
    }
  }, [settings.reducedMotion, setReducedMotion]);

  // Apply settings to document
  useEffect(() => {
    if (!mountedRef.current) return;
    const root = document.documentElement;

    // Font size
    root.style.fontSize = `${effectiveSettings.fontSize}%`;

    // High contrast
    if (effectiveSettings.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Screen reader hints
    if (effectiveSettings.screenReaderHints) {
      root.classList.add('sr-hints');
    } else {
      root.classList.remove('sr-hints');
    }

    saveSettings(effectiveSettings);
  }, [effectiveSettings]);

  // Alt+A keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.altKey && e.key === 'a') {
        e.preventDefault();
        setIsOpen((prev) => {
          const next = !prev;
          announceToScreenReader(
            next ? 'Accessibility toolbar opened' : 'Accessibility toolbar closed'
          );
          return next;
        });
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const updateSetting = useCallback(
    <K extends keyof A11ySettings>(key: K, value: A11ySettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };

        // Announce changes (deferred to avoid calling during render)
        requestAnimationFrame(() => {
          switch (key) {
            case 'fontSize':
              announceToScreenReader(`Font size set to ${value}%`);
              break;
            case 'highContrast':
              announceToScreenReader(
                value ? 'High contrast enabled' : 'High contrast disabled'
              );
              break;
            case 'reducedMotion':
              announceToScreenReader(
                value ? 'Reduced motion enabled' : 'Reduced motion disabled'
              );
              break;
            case 'screenReaderHints':
              announceToScreenReader(
                value ? 'Screen reader hints enabled' : 'Screen reader hints disabled'
              );
              break;
          }
        });

        return next;
      });
    },
    []
  );

  const decreaseFontSize = useCallback(() => {
    const next = Math.max(80, settings.fontSize - 10);
    updateSetting('fontSize', next);
  }, [settings.fontSize, updateSetting]);

  const increaseFontSize = useCallback(() => {
    const next = Math.min(150, settings.fontSize + 10);
    updateSetting('fontSize', next);
  }, [settings.fontSize, updateSetting]);

  const resetFontSize = useCallback(() => {
    updateSetting('fontSize', 100);
  }, [updateSetting]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Expanded panel */}
      {isOpen && (
        <div
          className="w-72 rounded-2xl border border-border bg-background p-4 shadow-2xl"
          role="region"
          aria-label="Accessibility settings"
        >
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Accessibility className="h-4 w-4" />
            Accessibility Settings
          </h3>

          <Separator className="mb-3" />

          {/* Font size controls */}
          <div className="mb-3">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Font Size ({settings.fontSize}%)
            </label>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={decreaseFontSize}
                disabled={settings.fontSize <= 80}
                aria-label="Decrease font size"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={resetFontSize}
                aria-label="Reset font size to 100%"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={increaseFontSize}
                disabled={settings.fontSize >= 150}
                aria-label="Increase font size"
              >
                <Plus className="h-3 w-3" />
              </Button>
              <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                {settings.fontSize}%
              </span>
            </div>
          </div>

          <Separator className="mb-3" />

          {/* High contrast toggle */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium">High Contrast</span>
            </div>
            <Button
              variant={effectiveSettings.highContrast ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() =>
                updateSetting('highContrast', !settings.highContrast)
              }
              aria-pressed={effectiveSettings.highContrast}
            >
              {effectiveSettings.highContrast ? 'On' : 'Off'}
            </Button>
          </div>

          {/* Reduced motion toggle */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium">Reduced Motion</span>
            </div>
            <Button
              variant={effectiveSettings.reducedMotion ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() =>
                updateSetting('reducedMotion', !settings.reducedMotion)
              }
              aria-pressed={effectiveSettings.reducedMotion}
            >
              {effectiveSettings.reducedMotion ? 'On' : 'Off'}
            </Button>
          </div>

          {/* Screen reader hints toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium">Screen Reader Hints</span>
            </div>
            <Button
              variant={effectiveSettings.screenReaderHints ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() =>
                updateSetting('screenReaderHints', !settings.screenReaderHints)
              }
              aria-pressed={effectiveSettings.screenReaderHints}
            >
              {effectiveSettings.screenReaderHints ? 'On' : 'Off'}
            </Button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <Button
        variant="outline"
        size="icon"
        className="rounded-full h-12 w-12 shadow-lg bg-background border-border hover:bg-accent"
        onClick={() => {
          setIsOpen((prev) => {
            const next = !prev;
            announceToScreenReader(
              next ? 'Accessibility toolbar opened' : 'Accessibility toolbar closed'
            );
            return next;
          });
        }}
        aria-label={isOpen ? 'Close accessibility settings' : 'Open accessibility settings'}
        aria-expanded={isOpen}
        aria-controls="a11y-toolbar-panel"
      >
        <Accessibility className="h-5 w-5" />
      </Button>
    </div>
  );
}
