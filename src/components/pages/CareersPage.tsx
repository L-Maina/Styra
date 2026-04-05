'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase, MapPin, DollarSign, Heart, TrendingUp, Users, Sparkles,
  ArrowRight, CheckCircle2, Clock, Send, User, Mail, Phone, AlertCircle,
} from 'lucide-react';
import {
  GlassCard, GlassButton, GlassInput, GlassBadge, GlassModal,
  FadeIn, Skeleton, GradientText,
} from '@/components/ui/custom/glass-components';

interface Job {
  id: string; title: string; department: string; location: string;
  type: string; description: string; requirements: string;
  _count?: { applications: number };
}

const perks = [
  { icon: DollarSign, label: 'Competitive Salary', desc: 'Above-market compensation' },
  { icon: Clock, label: 'Flexible Hours', desc: 'Work when you\'re most productive' },
  { icon: TrendingUp, label: 'Growth Opportunities', desc: 'Learning budget & career paths' },
  { icon: Heart, label: 'Health Benefits', desc: 'Medical insurance & wellness' },
  { icon: Users, label: 'Great Team', desc: 'Collaborative & diverse culture' },
  { icon: Sparkles, label: 'Latest Tools', desc: 'Modern tech stack & equipment' },
];

const deptColors: Record<string, string> = {
  Engineering: 'from-violet-500 to-purple-600',
  Design: 'from-pink-500 to-rose-600',
  Marketing: 'from-amber-500 to-orange-600',
  Operations: 'from-teal-500 to-emerald-600',
};

const parseReqs = (r: string): string[] => {
  try { return JSON.parse(r); } catch { return r.split('\n').filter(Boolean); }
};

export const CareersPage: React.FC<{ onNavigate?: (page: string) => void }> = ({ onNavigate }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMsg, setSubmitMsg] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [coverLetter, setCoverLetter] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/jobs');
        if (!res.ok) throw new Error('Failed to load jobs');
        const json = await res.json();
        if (!cancelled) setJobs(json.data?.jobs || []);
      } catch (err) {
        if (!cancelled) setFetchError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleApply = useCallback((job: Job) => {
    setSelectedJob(job); setShowModal(true);
    setSubmitStatus('idle'); setSubmitMsg('');
    setName(''); setEmail(''); setPhone(''); setCoverLetter('');
  }, []);

  const closeModal = useCallback(() => { setShowModal(false); setSelectedJob(null); }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedJob || !name.trim() || !email.trim()) return;
    setSubmitting(true); setSubmitStatus('idle');
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: selectedJob.id, name: name.trim(), email: email.trim(), phone: phone.trim() || null, coverLetter: coverLetter.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit');
      setSubmitStatus('success'); setSubmitMsg('Application submitted! We\'ll be in touch soon.');
    } catch (err) {
      setSubmitStatus('error'); setSubmitMsg(err instanceof Error ? err.message : 'Something went wrong');
    } finally { setSubmitting(false); }
  }, [selectedJob, name, email, phone, coverLetter]);

  const SkeletonCard = () => (
    <GlassCard className="p-6" hover={false}>
      <div className="flex gap-6">
        <Skeleton className="h-14 w-14 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="flex gap-2"><Skeleton className="h-6 w-56" /><Skeleton className="h-6 w-20 rounded-full" /></div>
          <Skeleton className="h-4 w-36" /><Skeleton className="h-4 w-full" />
        </div>
      </div>
    </GlassCard>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <FadeIn className="text-center mb-12">
          <motion.div className="w-20 h-20 rounded-2xl gradient-bg flex items-center justify-center mx-auto mb-6 shadow-glow"
            whileHover={{ scale: 1.05, rotate: 3 }} transition={{ duration: 0.3 }}>
            <Briefcase className="h-10 w-10 text-white" />
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Join <GradientText>Styra</GradientText></h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Help us transform the grooming industry in Africa. We&apos;re looking for passionate people who want to make a real impact.
          </p>
        </FadeIn>

        {/* Perks */}
        <FadeIn delay={0.1} className="mb-16">
          <h2 className="text-2xl font-bold mb-6 text-center">Why Work at Styra?</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {perks.map((perk, i) => (
              <motion.div key={perk.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.05 }}>
                <GlassCard className="p-5 text-center h-full">
                  <perk.icon className="h-7 w-7 mx-auto mb-3 text-primary" />
                  <h3 className="font-semibold text-sm mb-1">{perk.label}</h3>
                  <p className="text-xs text-muted-foreground">{perk.desc}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </FadeIn>

        {/* Positions */}
        <FadeIn delay={0.2}>
          <h2 className="text-2xl font-bold mb-6">
            Open Positions
            {!loading && <span className="ml-2 text-base font-normal text-muted-foreground">({jobs.length} opening{jobs.length !== 1 ? 's' : ''})</span>}
          </h2>

          {loading && <div className="space-y-6 mb-16">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>}

          {fetchError && !loading && (
            <div className="mb-16">
              <GlassCard variant="bordered" className="p-8 text-center" hover={false}>
                <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
                <p className="text-lg font-semibold mb-1">Failed to load positions</p>
                <p className="text-sm text-muted-foreground mb-4">{fetchError}</p>
                <GlassButton variant="outline" onClick={() => window.location.reload()}>Try Again</GlassButton>
              </GlassCard>
            </div>
          )}

          {!loading && !fetchError && jobs.length === 0 && (
            <div className="mb-16">
              <GlassCard variant="bordered" className="p-8 text-center" hover={false}>
                <Briefcase className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-lg font-semibold mb-1">No open positions right now</p>
                <p className="text-sm text-muted-foreground">Check back soon — we&apos;re always growing!</p>
              </GlassCard>
            </div>
          )}

          {!loading && !fetchError && jobs.length > 0 && (
            <div className="space-y-6 mb-16">
              {jobs.map((job, i) => {
                const reqs = parseReqs(job.requirements);
                const grad = deptColors[job.department] || 'from-violet-500 to-purple-600';
                return (
                  <motion.div key={job.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.05 }}>
                    <GlassCard className="p-6">
                      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                        <div className={`h-14 w-14 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center flex-shrink-0`}>
                          <Briefcase className="h-7 w-7 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                            <h3 className="text-lg font-bold">{job.title}</h3>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <GlassBadge variant="primary" className="text-xs">{job.department}</GlassBadge>
                              <GlassBadge variant="secondary" className="text-xs">{job.type}</GlassBadge>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>
                            {job._count && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{job._count.applications} applicant{job._count.applications !== 1 ? 's' : ''}</span>}
                          </div>
                          <p className="text-sm text-muted-foreground mb-4">{job.description}</p>
                          <div className="mb-4">
                            <p className="text-sm font-medium mb-2">Requirements:</p>
                            <ul className="grid sm:grid-cols-2 gap-1">
                              {reqs.map((r) => (
                                <li key={r} className="flex items-start gap-2 text-sm text-muted-foreground">
                                  <CheckCircle2 className="h-4 w-4 text-primary/60 mt-0.5 flex-shrink-0" />{r}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <GlassButton variant="primary" size="sm" rightIcon={<ArrowRight className="h-4 w-4" />} onClick={() => handleApply(job)}>
                            Apply Now
                          </GlassButton>
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                );
              })}
            </div>
          )}
        </FadeIn>

        {/* CTA */}
        <FadeIn delay={0.3}>
          <GlassCard variant="elevated" className="p-8 text-center">
            <h3 className="text-xl font-bold mb-2">Don&apos;t see the right role?</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              We&apos;re always looking for talented people. Send us your resume and we&apos;ll reach out when a suitable position opens up.
            </p>
            <GlassButton variant="outline" leftIcon={<Briefcase className="h-4 w-4" />} onClick={() => onNavigate?.('contact')}>
              Send General Application
            </GlassButton>
          </GlassCard>
        </FadeIn>
      </div>

      {/* Apply Modal */}
      <GlassModal isOpen={showModal} onClose={closeModal}
        title={selectedJob ? `Apply: ${selectedJob.title}` : 'Apply'}
        description={selectedJob ? `${selectedJob.department} · ${selectedJob.location} · ${selectedJob.type}` : undefined} size="lg">
        {submitStatus === 'success' ? (
          <div className="text-center py-6">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}>
              <CheckCircle2 className="h-14 w-14 text-green-400 mx-auto mb-4" />
            </motion.div>
            <p className="text-lg font-semibold mb-2">Application Sent!</p>
            <p className="text-sm text-muted-foreground mb-6">{submitMsg}</p>
            <GlassButton variant="outline" onClick={closeModal}>Close</GlassButton>
          </div>
        ) : (
          <div className="space-y-4">
            {submitStatus === 'error' && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-xl p-3">
                <AlertCircle className="h-4 w-4 flex-shrink-0" /><span>{submitMsg}</span>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1.5">Full Name *</label>
              <GlassInput placeholder="John Mwangi" value={name} onChange={(e) => setName(e.target.value)} leftIcon={<User className="h-4 w-4" />} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Email *</label>
              <GlassInput placeholder="john@example.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} leftIcon={<Mail className="h-4 w-4" />} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Phone</label>
              <GlassInput placeholder="+254 700 000 000" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} leftIcon={<Phone className="h-4 w-4" />} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Cover Letter</label>
              <textarea placeholder="Tell us why you're a great fit for this role..." value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)} rows={4}
                className="flex w-full rounded-xl border border-border bg-background/50 backdrop-blur-sm px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-[box-shadow,border-color] duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none" />
            </div>
            <div className="flex gap-3 pt-2">
              <GlassButton variant="outline" onClick={closeModal} className="flex-1">Cancel</GlassButton>
              <GlassButton variant="primary" onClick={handleSubmit} isLoading={submitting}
                disabled={!name.trim() || !email.trim()} rightIcon={!submitting ? <Send className="h-4 w-4" /> : undefined} className="flex-1">
                Submit Application
              </GlassButton>
            </div>
          </div>
        )}
      </GlassModal>
    </div>
  );
};

export default CareersPage;
