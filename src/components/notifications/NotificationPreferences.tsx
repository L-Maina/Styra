'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  BellOff,
  Mail,
  Smartphone,
  Calendar,
  MessageSquare,
  Tag,
  Star,
  CreditCard,
  Save,
  RotateCcw,
  Moon,
  Loader2,
  Check,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────

interface NotificationPreferencesData {
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  bookingUpdates: boolean;
  messageNotifications: boolean;
  promotionNotifications: boolean;
  reviewNotifications: boolean;
  paymentNotifications: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

interface NotificationPreferencesPanelProps {
  className?: string;
}

// ── Default preferences ────────────────────────────────────────────────

const DEFAULT_PREFERENCES: NotificationPreferencesData = {
  pushEnabled: true,
  emailEnabled: true,
  smsEnabled: false,
  bookingUpdates: true,
  messageNotifications: true,
  promotionNotifications: true,
  reviewNotifications: true,
  paymentNotifications: true,
  quietHoursStart: null,
  quietHoursEnd: null,
};

// ── Component ──────────────────────────────────────────────────────────

export function NotificationPreferencesPanel({ className }: NotificationPreferencesPanelProps) {
  const [preferences, setPreferences] = useState<NotificationPreferencesData>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Fetch preferences on mount ──────────────────────────────────────

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/notifications/preferences', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setPreferences({
            pushEnabled: json.data.pushEnabled ?? true,
            emailEnabled: json.data.emailEnabled ?? true,
            smsEnabled: json.data.smsEnabled ?? false,
            bookingUpdates: json.data.bookingUpdates ?? true,
            messageNotifications: json.data.messageNotifications ?? true,
            promotionNotifications: json.data.promotionNotifications ?? true,
            reviewNotifications: json.data.reviewNotifications ?? true,
            paymentNotifications: json.data.paymentNotifications ?? true,
            quietHoursStart: json.data.quietHoursStart ?? null,
            quietHoursEnd: json.data.quietHoursEnd ?? null,
          });
        }
      }
    } catch {
      // Silently fail — preferences will use defaults
    } finally {
      setIsLoading(false);
    }
  };

  // ── Toggle handler ──────────────────────────────────────────────────

  type BooleanField = {
    [K in keyof NotificationPreferencesData]: NotificationPreferencesData[K] extends boolean ? K : never;
  }[keyof NotificationPreferencesData];

  const handleToggle = useCallback((field: BooleanField) => {
    setPreferences((prev) => {
      const next = { ...prev };
      next[field] = !prev[field];
      return next;
    });
    setHasChanges(true);
    setSaveSuccess(false);
  }, []);

  // ── Time input handler ──────────────────────────────────────────────

  const handleTimeChange = useCallback(
    (field: 'quietHoursStart' | 'quietHoursEnd', value: string) => {
      setPreferences((prev) => ({
        ...prev,
        [field]: value || null,
      }));
      setHasChanges(true);
      setSaveSuccess(false);
    },
    []
  );

  // ── Save handler ────────────────────────────────────────────────────

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });
      if (res.ok) {
        setHasChanges(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      // Silently fail
    } finally {
      setIsSaving(false);
    }
  };

  // ── Reset handler ───────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    setHasChanges(true);
    setSaveSuccess(false);
  }, []);

  // ── Loading state ───────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center p-12', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn('w-full space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Notification Preferences</h2>
          <p className="text-sm text-muted-foreground">
            Control how and when you receive notifications
          </p>
        </div>
      </div>

      {/* Delivery Channels */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Delivery Channels
        </h3>
        <div className="space-y-4">
          {/* Push Notifications */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                <Bell className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Push Notifications</p>
                <p className="text-xs text-muted-foreground">Browser push alerts</p>
              </div>
            </div>
            <Switch
              checked={preferences.pushEnabled}
              onCheckedChange={() => handleToggle('pushEnabled')}
            />
          </div>

          {/* Email */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10">
                <Mail className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Email</p>
                <p className="text-xs text-muted-foreground">Receive updates via email</p>
              </div>
            </div>
            <Switch
              checked={preferences.emailEnabled}
              onCheckedChange={() => handleToggle('emailEnabled')}
            />
          </div>

          {/* SMS */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10">
                <Smartphone className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">SMS</p>
                <p className="text-xs text-muted-foreground">Text message alerts</p>
              </div>
            </div>
            <Switch
              checked={preferences.smsEnabled}
              onCheckedChange={() => handleToggle('smsEnabled')}
            />
          </div>
        </div>
      </section>

      {/* Notification Types */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Notification Types
        </h3>
        <div className="space-y-4">
          {/* Bookings */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                <Calendar className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Booking Updates</p>
                <p className="text-xs text-muted-foreground">Confirmations, reminders, changes</p>
              </div>
            </div>
            <Switch
              checked={preferences.bookingUpdates}
              onCheckedChange={() => handleToggle('bookingUpdates')}
            />
          </div>

          {/* Messages */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10">
                <MessageSquare className="h-4 w-4 text-sky-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Messages</p>
                <p className="text-xs text-muted-foreground">Chat and direct messages</p>
              </div>
            </div>
            <Switch
              checked={preferences.messageNotifications}
              onCheckedChange={() => handleToggle('messageNotifications')}
            />
          </div>

          {/* Promotions */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-500/10">
                <Tag className="h-4 w-4 text-pink-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Promotions</p>
                <p className="text-xs text-muted-foreground">Deals, offers, and recommendations</p>
              </div>
            </div>
            <Switch
              checked={preferences.promotionNotifications}
              onCheckedChange={() => handleToggle('promotionNotifications')}
            />
          </div>

          {/* Reviews */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-500/10">
                <Star className="h-4 w-4 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Reviews</p>
                <p className="text-xs text-muted-foreground">New reviews and ratings</p>
              </div>
            </div>
            <Switch
              checked={preferences.reviewNotifications}
              onCheckedChange={() => handleToggle('reviewNotifications')}
            />
          </div>

          {/* Payments */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10">
                <CreditCard className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Payments</p>
                <p className="text-xs text-muted-foreground">Payment confirmations and receipts</p>
              </div>
            </div>
            <Switch
              checked={preferences.paymentNotifications}
              onCheckedChange={() => handleToggle('paymentNotifications')}
            />
          </div>
        </div>
      </section>

      {/* Quiet Hours */}
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10">
            <Moon className="h-4 w-4 text-indigo-500" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Quiet Hours
            </h3>
            <p className="text-xs text-muted-foreground">
              Pause notifications during specific hours
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Quiet Start
            </label>
            <input
              type="time"
              value={preferences.quietHoursStart || ''}
              onChange={(e) => handleTimeChange('quietHoursStart', e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 dark:bg-slate-900/50"
              placeholder="--:--"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Quiet End
            </label>
            <input
              type="time"
              value={preferences.quietHoursEnd || ''}
              onChange={(e) => handleTimeChange('quietHoursEnd', e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 dark:bg-slate-900/50"
              placeholder="--:--"
            />
          </div>
        </div>
      </section>

      <Separator />

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="min-w-[120px]"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : saveSuccess ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Saved!
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>

        <Button variant="outline" onClick={handleReset} disabled={isSaving}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>

        {hasChanges && (
          <span className="text-xs text-muted-foreground">
            You have unsaved changes
          </span>
        )}
      </div>
    </div>
  );
}

export default NotificationPreferencesPanel;
