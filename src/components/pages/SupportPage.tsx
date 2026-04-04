'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HelpCircle, Phone, Mail, ChevronDown, Search, Clock, MapPin, Send,
  CheckCircle2, AlertCircle, BookOpen, ExternalLink, RefreshCw, MessageSquare,
} from 'lucide-react';
import { GlassCard, GlassButton, GlassInput, GlassBadge, FadeIn, Skeleton } from '@/components/ui/custom/glass-components';

interface SupportPageProps { onNavigate?: (page: string) => void }

interface FAQItem { id: string; question: string; answer: string; category: string; order: number }

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All Topics',
  booking: 'Booking & Appointments',
  payments: 'Payments & Refunds',
  account: 'Account & Profile',
  provider: 'Service Provider',
  general: 'General',
};

export const SupportPage: React.FC<SupportPageProps> = ({ onNavigate }) => {
  /* ── Dynamic data state ── */
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [apiCategories, setApiCategories] = useState<string[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loadingFaqs, setLoadingFaqs] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  /* ── UI state ── */
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  /* ── Fetch FAQs from API ── */
  const fetchFaqs = useCallback(async () => {
    setLoadingFaqs(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/faqs');
      if (!res.ok) throw new Error(`Failed to fetch FAQs (${res.status})`);
      const json = await res.json();
      if (json.success) {
        setFaqs(json.data.faqs ?? []);
        setApiCategories(json.data.categories ?? []);
      } else {
        throw new Error(json.error || 'Unknown error');
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load FAQs');
    } finally {
      setLoadingFaqs(false);
    }
  }, []);

  /* ── Fetch site settings from API ── */
  const fetchSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const keys = 'support_email,phone_number,address,business_hours,site_name';
      const res = await fetch(`/api/site-settings?keys=${encodeURIComponent(keys)}`);
      if (!res.ok) throw new Error('Failed to fetch settings');
      const json = await res.json();
      if (json.success) setSettings(json.data.settings ?? {});
    } catch {
      // Settings failure is non-critical; fallback defaults used below
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    fetchFaqs();
    fetchSettings();
  }, [fetchFaqs, fetchSettings]);

  /* ── Build category tabs ── */
  const allCategories = [
    'all',
    ...Array.from(new Set([...apiCategories, 'booking', 'payments', 'account', 'provider'])),
  ];

  /* ── Filter FAQs by category + search ── */
  const filteredFaqs = faqs.filter((faq) => {
    const matchesCat = selectedCategory === 'all' || faq.category === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      q === '' ||
      faq.question.toLowerCase().includes(q) ||
      faq.answer.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  /* ── Contact form submission ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'SUPPORT', ...contactForm }),
      });
      if (res.ok) {
        setSubmitStatus('success');
        setContactForm({ name: '', email: '', subject: '', message: '' });
      } else {
        setSubmitStatus('error');
      }
    } catch {
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Contact info from settings (with fallbacks) ── */
  const contactEmail = settings.support_email || 'support@styra.app';
  const contactPhone = settings.phone_number || '+254 712 345 678';
  const contactAddress = settings.address || 'Nairobi, Kenya';
  const contactHours = settings.business_hours || 'Mon-Fri 8am-6pm EAT';

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-60 h-60 rounded-full bg-gradient-to-br from-secondary/10 to-primary/10 blur-3xl" />
        <div className="absolute bottom-20 right-10 w-40 h-40 rounded-full bg-gradient-to-br from-primary/5 to-secondary/5 blur-2xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* ═══════════════ Hero Section ═══════════════ */}
        <FadeIn className="text-center mb-12">
          <motion.div
            className="w-20 h-20 rounded-2xl gradient-bg flex items-center justify-center mx-auto mb-6 shadow-glow"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <HelpCircle className="h-10 w-10 text-white" />
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            How Can We <span className="gradient-text">Help You?</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-8 text-lg">
            Find answers to common questions or get in touch with our support team.
            We&apos;re here to make your experience seamless.
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto relative">
            <GlassInput
              placeholder="Search for help articles, FAQs, topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="h-5 w-5" />}
              className="w-full text-base py-6 pl-12 pr-4 h-14 rounded-2xl shadow-lg"
            />
            {searchQuery && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute right-4 top-1/2 -translate-y-1/2"
              >
                <GlassBadge variant="primary">{filteredFaqs.length} results</GlassBadge>
              </motion.div>
            )}
          </div>
        </FadeIn>

        {/* ═══════════════ FAQ Section ═══════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* FAQ Accordion (2/3 width) */}
          <FadeIn delay={0.1} className="lg:col-span-2">
            <GlassCard variant="elevated" className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Frequently Asked Questions
                </h2>
                {searchQuery && (
                  <GlassBadge variant="primary">
                    {filteredFaqs.length} result{filteredFaqs.length !== 1 ? 's' : ''}
                  </GlassBadge>
                )}
              </div>

              {/* Category Filter Tabs */}
              <div className="flex flex-wrap gap-2 mb-6">
                {allCategories.map((cat) => (
                  <GlassButton
                    key={cat}
                    variant={selectedCategory === cat ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {CATEGORY_LABELS[cat] || cat}
                  </GlassButton>
                ))}
              </div>

              {/* Loading Skeletons */}
              {loadingFaqs && (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-border/50 p-4 space-y-3">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  ))}
                </div>
              )}

              {/* Error State */}
              {!loadingFaqs && fetchError && (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                  <p className="text-muted-foreground mb-2">Failed to load FAQs</p>
                  <p className="text-sm text-muted-foreground mb-4">{fetchError}</p>
                  <GlassButton
                    variant="outline"
                    size="sm"
                    leftIcon={<RefreshCw className="h-4 w-4" />}
                    onClick={fetchFaqs}
                  >
                    Retry
                  </GlassButton>
                </div>
              )}

              {/* Dynamic FAQ List from API */}
              {!loadingFaqs && !fetchError && (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
                  <AnimatePresence mode="popLayout">
                    {filteredFaqs.map((faq, index) => (
                      <motion.div
                        key={faq.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ delay: index * 0.03 }}
                        className="glass-card rounded-xl overflow-hidden"
                      >
                        <button
                          onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                          className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-primary/5 transition-colors"
                        >
                          <span className="font-medium text-sm pr-4">{faq.question}</span>
                          <motion.div
                            animate={{ rotate: expandedFaq === faq.id ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          </motion.div>
                        </button>
                        <AnimatePresence>
                          {expandedFaq === faq.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4 pt-2 border-t border-border/50">
                                <p className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
                                <div className="mt-3 flex items-center gap-2">
                                  <GlassBadge variant="default" className="text-xs">
                                    {CATEGORY_LABELS[faq.category] || faq.category}
                                  </GlassBadge>
                                  <span className="text-xs text-muted-foreground">Was this helpful?</span>
                                  <button className="text-xs text-primary hover:underline">Yes</button>
                                  <button className="text-xs text-muted-foreground hover:text-primary">No</button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Empty State */}
                  {filteredFaqs.length === 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
                      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                        <HelpCircle className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground mb-2">No FAQs found matching your search.</p>
                      <p className="text-sm text-muted-foreground mb-4">Try different keywords or browse by category.</p>
                      <GlassButton
                        variant="outline"
                        size="sm"
                        onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
                      >
                        Clear filters
                      </GlassButton>
                    </motion.div>
                  )}
                </div>
              )}
            </GlassCard>
          </FadeIn>

          {/* Contact Info Sidebar (1/3 width) */}
          <FadeIn delay={0.2}>
            <div className="space-y-4">
              {loadingSettings ? (
                /* Skeleton while loading settings */
                <>
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </>
              ) : (
                <>
                  {/* Phone */}
                  <GlassCard hover className="group">
                    <a href={`tel:${contactPhone.replace(/\s/g, '')}`} className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center shadow-glow-sm flex-shrink-0">
                        <Phone className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm">Phone Support</h3>
                        <p className="text-xs text-muted-foreground">{contactHours}</p>
                        <p className="text-sm text-primary font-medium truncate">{contactPhone}</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </a>
                  </GlassCard>

                  {/* Email */}
                  <GlassCard hover className="group">
                    <a href={`mailto:${contactEmail}`} className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center shadow-glow-sm flex-shrink-0">
                        <Mail className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm">Email Us</h3>
                        <p className="text-xs text-muted-foreground">Response within 24 hours</p>
                        <p className="text-sm text-primary font-medium truncate">{contactEmail}</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </a>
                  </GlassCard>

                  {/* Address */}
                  <GlassCard hover className="group">
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(contactAddress)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3"
                    >
                      <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center shadow-glow-sm flex-shrink-0">
                        <MapPin className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm">Visit Us</h3>
                        <p className="text-sm text-muted-foreground truncate">{contactAddress}</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </a>
                  </GlassCard>

                  {/* Business Hours */}
                  <GlassCard variant="bordered">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Support Hours</p>
                        <p className="text-xs text-muted-foreground">{contactHours}</p>
                      </div>
                    </div>
                  </GlassCard>
                </>
              )}
            </div>
          </FadeIn>
        </div>

        {/* ═══════════════ Contact Form ═══════════════ */}
        <FadeIn delay={0.3}>
          <GlassCard variant="elevated" className="relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 gradient-bg" />
            <div className="p-6">
              {/* Form Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
                  <Send className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Send Us a Message</h2>
                  <p className="text-sm text-muted-foreground">We&apos;ll get back to you within 24 hours</p>
                </div>
              </div>

              {/* Status Messages */}
              <AnimatePresence>
                {submitStatus === 'success' && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-3"
                  >
                    <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0" />
                    <p className="text-sm text-green-700 dark:text-green-400">
                      Message sent successfully! We&apos;ll respond within 24 hours.
                    </p>
                  </motion.div>
                )}
                {submitStatus === 'error' && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3"
                  >
                    <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-400">
                      Failed to send message. Please try again or contact us directly.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form Fields */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Name</label>
                    <GlassInput
                      placeholder="Your name"
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      required
                      className="h-11"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Email</label>
                    <GlassInput
                      type="email"
                      placeholder="your@email.com"
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      required
                      className="h-11"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Subject</label>
                  <GlassInput
                    placeholder="How can we help?"
                    value={contactForm.subject}
                    onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                    required
                    className="h-11"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Message</label>
                  <textarea
                    placeholder="Describe your issue or question in detail..."
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    required
                    className="w-full min-h-[140px] p-4 rounded-xl border border-input bg-background/50 backdrop-blur-sm text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none transition-[box-shadow,border-color] duration-200"
                  />
                </div>
                <div className="flex justify-end">
                  <GlassButton
                    type="submit"
                    variant="primary"
                    size="lg"
                    rightIcon={!isSubmitting ? <Send className="h-4 w-4" /> : undefined}
                    disabled={isSubmitting}
                    isLoading={isSubmitting}
                  >
                    {isSubmitting ? 'Sending...' : 'Send Message'}
                  </GlassButton>
                </div>
              </form>
            </div>
          </GlassCard>
        </FadeIn>
      </div>
    </div>
  );
};

export default SupportPage;
