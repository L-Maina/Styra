'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Users, Building2, CheckCircle, XCircle, Clock, Eye, Search,
  ChevronDown, Mail, Phone, MapPin, AlertTriangle, Check, X, Loader2,
  Calendar, DollarSign, TrendingUp, Settings, BarChart3, Activity, Bell,
  Lock, Percent, Download, RefreshCw, MessageSquare, AlertCircle, Star,
  CreditCard, Crown, Zap, ArrowUpRight, PieChart, Ban, UserCheck, FileText,
  Send, Globe, Newspaper, Flag, UserX, LifeBuoy, ClipboardCheck, Edit,
  Trash2, Filter, ShieldCheck, Unlock, Inbox, FileWarning, User, Tag,
  Menu, ChevronLeft, LayoutDashboard, Briefcase, Ticket, BookOpen, Gavel,
  Megaphone, MessageCircle, Plus, ChevronRight, Save, Palette,
  Webhook as WebhookIcon, Image as ImageIcon,
} from 'lucide-react';
import {
  GlassCard, GlassButton, GlassInput, GlassBadge, FadeIn, GlassModal, Skeleton,
} from '@/components/ui/custom/glass-components';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/ui/brand-logo';
import { useAuthStore } from '@/store';
import api from '@/lib/api-client';
import { toast } from 'sonner';

// ============================================
// TYPE DEFINITIONS
// ============================================

type SectionId = 'overview' | 'revenue' | 'users' | 'businesses' | 'bookings' |
  'listings' | 'disputes-reports' | 'claims-support' | 'content' | 'advertisements' | 'settings' | 'faq' | 'careers' | 'team' |
  'brand-kit' | 'monitoring' | 'webhooks';

interface AdminUser {
  id: string; email: string; name: string; phone?: string; role: string;
  isVerified: boolean; isBanned: boolean; status: string;
  totalSpent: number; createdAt: string; updatedAt: string;
  business?: { id: string; name: string };
}

interface AdminBusiness {
  id: string; name: string; description?: string; category: string;
  city?: string; rating: number; reviewCount: number;
  verificationStatus: string; isActive: boolean; createdAt: string;
  owner: { id: string; name: string; email: string };
  _count: { services: number; staff: number };
}

interface AdminBooking {
  id: string; status: string; date: string; time: string; totalPrice: number;
  customerName?: string; customerEmail?: string; serviceName?: string; staffName?: string;
  createdAt: string;
  business: { id: string; name: string; category: string };
  payments: { id: string; amount: number; status: string; method: string }[];
}

interface AdminDispute {
  id: string; bookingId: string; status: string; reason?: string;
  description?: string; amount: number; createdAt: string; resolvedAt?: string;
  resolution?: { type: string; amount: number; notes: string };
  customerName?: string; providerName?: string;
}

interface AdminReport {
  id: string; reporterId: string; reporterName: string;
  reportedUserId: string; reportedUserName: string;
  type: string; reason: string; description: string;
  status: string; createdAt: string; resolvedAt?: string;
}

interface AdminTicket {
  id: string; userId: string; userName: string; userEmail: string;
  subject: string; message: string; category: string; priority: string;
  status: string; replies: { id: string; from: string; message: string; createdAt: string }[];
  createdAt: string; updatedAt: string; assignedTo?: string;
}

interface AdminClaim {
  id: string; claimNumber: string; customerId: string; customerName: string;
  providerId: string; providerName: string; bookingId: string;
  type: string; description: string; amount: number; currency: string;
  status: string; createdAt: string; reviewedAt?: string;
  adminNotes?: string; resolution?: string;
}

interface AdminListing {
  id: string; businessName: string; businessId: string; plan: string;
  price: number; status: string; startDate: string; endDate: string;
  impressions?: number; clicks?: number; createdAt: string;
}

interface AdminArticle {
  id: string; title: string; slug: string; excerpt: string;
  author: string; category: string; status: string;
  views: number; likes: number; createdAt: string; updatedAt: string;
}

interface PageContent {
  id: string; page: string; title: string; content: string;
  updatedAt: string; updatedBy: string;
}

interface OverviewData {
  overview: {
    totalUsers: number; totalBusinesses: number; totalBookings: number;
    totalRevenue: number; totalCommissions: number; totalDisputes: number; revenueGrowth: number;
  };
  monthly: { revenue: number; commissions: number; bookings: number };
  pending: {
    applications: number; reports: number; disputes: number;
    listings: number; tickets: number; claims: number; ads: number;
  };
  revenueChart: { month: string; revenue: number; commissions: number }[];
  recentPayments: { id: string; amount: number; status: string; method: string; date: string; userName?: string }[];
  settings: PlatformSettings;
}

interface PlatformSettings {
  platformFee: number; minWithdrawal: number; maintenanceMode: boolean;
  emailNotifications: boolean; smsNotifications: boolean;
  autoApproveBusinesses: boolean; requireIdVerification: boolean;
  featuredListingPrice: number; premiumListingPrice: number;
  // Website Contact Info
  company_name?: string; company_tagline?: string; company_description?: string;
  support_email?: string; press_email?: string; phone?: string; address?: string;
  social_instagram?: string; social_twitter?: string; social_facebook?: string;
  social_tiktok?: string; social_linkedin?: string; social_youtube?: string;
  whatsapp_number?: string; business_hours?: string; support_response_time?: string;
  website_url?: string;
}

interface AdminDashboardProps {
  initialTab?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const fmtDate = (v: string | Date | null | undefined) =>
  v ? new Date(v).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';

const fmtDateTime = (v: string | Date | null | undefined) =>
  v ? new Date(v).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

const fmtCurrency = (v: number | null | undefined) => `KSh ${(v || 0).toLocaleString('en-KE')}`;

const statusColor = (status: string) => {
  const s = (status || '').toUpperCase();
  if (['ACTIVE', 'APPROVED', 'COMPLETED', 'RESOLVED', 'PAID', 'PUBLISHED'].includes(s)) return 'success';
  if (['PENDING', 'IN_PROGRESS', 'UNDER_REVIEW', 'SUBMITTED', 'OPEN'].includes(s)) return 'warning';
  if (['REJECTED', 'SUSPENDED', 'BANNED', 'CANCELLED', 'FAILED', 'DISMISSED'].includes(s)) return 'destructive';
  return 'default';
};

// ============================================
// LOADING SKELETON
// ============================================

const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4 items-center">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
    ))}
  </div>
);

const EmptyState = ({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
      <Icon className="h-8 w-8 text-muted-foreground" />
    </div>
    <h3 className="font-semibold mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ initialTab = 'overview' }) => {
  const { user } = useAuthStore();
  const isAdmin = (user?.roles || []).some((r: string) => r.toUpperCase() === 'ADMIN') || (user?.role || '').toUpperCase() === 'ADMIN';

  // ---- Navigation ----
  const [activeSection, setActiveSection] = useState<SectionId>(initialTab as SectionId);

  // Sync activeSection when initialTab prop changes (e.g. from profile dropdown navigation)
  useEffect(() => {
    if (initialTab && initialTab !== activeSection) {
      setActiveSection(initialTab as SectionId);
    }
  }, [initialTab]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    cms: true, reports: true, settings: false,
  });

  const toggleGroup = (group: string) =>
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));

  // ---- Data states ----
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [displayUsers, setDisplayUsers] = useState<AdminUser[]>([]);
  const [displayBusinesses, setDisplayBusinesses] = useState<AdminBusiness[]>([]);
  const [displayBookings, setDisplayBookings] = useState<AdminBooking[]>([]);
  const [displayListings, setDisplayListings] = useState<AdminListing[]>([]);
  const [displayDisputes, setDisplayDisputes] = useState<AdminDispute[]>([]);
  const [displayReports, setDisplayReports] = useState<AdminReport[]>([]);
  const [displayTickets, setDisplayTickets] = useState<AdminTicket[]>([]);
  const [displayClaims, setDisplayClaims] = useState<AdminClaim[]>([]);
  const [displayArticles, setDisplayArticles] = useState<AdminArticle[]>([]);
  const [displayAds, setDisplayAds] = useState<any[]>([]);
  const [displayPageContent, setDisplayPageContent] = useState<PageContent[]>([]);
  const [displayFaqs, setDisplayFaqs] = useState<any[]>([]);
  const [displayJobs, setDisplayJobs] = useState<any[]>([]);
  const [displayTeamMembers, setDisplayTeamMembers] = useState<any[]>([]);
  const [displayBrandKit, setDisplayBrandKit] = useState<any>(null);
  const [displayPressKit, setDisplayPressKit] = useState<any>(null);
  const [displayMonitoring, setDisplayMonitoring] = useState<any>(null);
  const [displayWebhooks, setDisplayWebhooks] = useState<any>(null);
  const [settings, setSettings] = useState<PlatformSettings>({
    platformFee: 15, minWithdrawal: 50, maintenanceMode: false,
    emailNotifications: true, smsNotifications: false,
    autoApproveBusinesses: false, requireIdVerification: true,
    featuredListingPrice: 99, premiumListingPrice: 49,
  });

  // ---- UI states ----
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dataFetched, setDataFetched] = useState<Record<string, boolean>>({});

  // ---- Filter states ----
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [bizStatusFilter, setBizStatusFilter] = useState('');
  const [bizSearch, setBizSearch] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('');
  const [bookingSearch, setBookingSearch] = useState('');
  const [disputeFilter, setDisputeFilter] = useState('all');
  const [reportFilter, setReportFilter] = useState('all');
  const [ticketStatusFilter, setTicketStatusFilter] = useState('all');
  const [claimStatusFilter, setClaimStatusFilter] = useState('all');

  // ---- Modal states ----
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectType, setRejectType] = useState<'business' | 'listing'>('business');

  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);
  const [disputeResponse, setDisputeResponse] = useState('');
  const [resolutionType, setResolutionType] = useState('FULL_REFUND');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [partialRefundAmount, setPartialRefundAmount] = useState(0);

  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketReply, setTicketReply] = useState('');

  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [showListingModal, setShowListingModal] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [listingEditData, setListingEditData] = useState({ plan: 'FEATURED', price: 99, endDate: '' });

  const [showContentModal, setShowContentModal] = useState(false);
  const [editingPage, setEditingPage] = useState<PageContent | null>(null);
  const [contentEditTitle, setContentEditTitle] = useState('');
  const [contentEditBody, setContentEditBody] = useState('');

  const [showArticleModal, setShowArticleModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState<AdminArticle | null>(null);
  const [articleForm, setArticleForm] = useState({ title: '', slug: '', excerpt: '', content: '', category: '', tags: '', isFeatured: false, isPublished: false, image: '', readTime: 5 });

  const [showAdModal, setShowAdModal] = useState(false);
  const [editingAd, setEditingAd] = useState<any>(null);
  const [adForm, setAdForm] = useState({ businessName: '', contactEmail: '', contactPhone: '', package: 'BASIC', duration: 30, budget: 0, notes: '', status: 'PENDING' });

  const [showClaimModal, setShowClaimModal] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [claimNotes, setClaimNotes] = useState('');
  const [claimAction, setClaimAction] = useState('');

  // ---- Data fetching ----

  const fetchOverview = useCallback(async () => {
    try {
      const res = await api.request<Record<string, any>>('/admin/overview');
      const d = res.data;
      if (d) {
        setOverviewData(d as OverviewData);
        if (d.settings) {
          setSettings({
            platformFee: d.settings.platformFee ?? 15,
            minWithdrawal: d.settings.minWithdrawal ?? 50,
            maintenanceMode: d.settings.maintenanceMode ?? false,
            emailNotifications: d.settings.emailNotifications ?? true,
            smsNotifications: d.settings.smsNotifications ?? false,
            autoApproveBusinesses: d.settings.autoApproveBusinesses ?? false,
            requireIdVerification: d.settings.requireIdVerification ?? true,
            featuredListingPrice: d.settings.featuredListingPrice ?? 99,
            premiumListingPrice: d.settings.premiumListingPrice ?? 49,
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch overview:', err);
    }
  }, []);

  const fetchSectionData = useCallback(async (section: SectionId) => {
    setIsLoading(true);
    try {
      switch (section) {
        case 'overview':
          await fetchOverview();
          break;
        case 'users': {
          const params: Record<string, string> = {};
          if (userSearch) params.search = userSearch;
          if (userRoleFilter) params.role = userRoleFilter;
          const res = await api.request<Record<string, any>>('/admin/users', { params });
          setDisplayUsers(res.data?.users || []);
          break;
        }
        case 'businesses': {
          const params: Record<string, string> = {};
          if (bizStatusFilter) params.status = bizStatusFilter;
          if (bizSearch) params.query = bizSearch;
          const res = await api.request<Record<string, any>>('/admin/businesses', { params });
          setDisplayBusinesses(res.data?.data || []);
          break;
        }
        case 'bookings': {
          const params: Record<string, string> = {};
          if (bookingStatusFilter) params.status = bookingStatusFilter;
          if (bookingSearch) params.search = bookingSearch;
          const res = await api.request<Record<string, any>>('/admin/bookings', { params });
          setDisplayBookings(res.data?.bookings || []);
          break;
        }
        case 'listings': {
          const res = await api.request<Record<string, any>>('/admin/listings');
          setDisplayListings(res.data?.listings || []);
          break;
        }
        case 'disputes-reports': {
          const [disputeRes, reportRes] = await Promise.all([
            api.request<Record<string, any>>('/admin/disputes'),
            api.request<Record<string, any>>('/admin/reports'),
          ]);
          setDisplayDisputes(disputeRes.data?.disputes || []);
          setDisplayReports(reportRes.data?.reports || []);
          break;
        }
        case 'claims-support': {
          const [claimRes, ticketRes] = await Promise.all([
            api.request<Record<string, any>>('/admin/claims'),
            api.request<Record<string, any>>('/admin/tickets'),
          ]);
          setDisplayClaims(claimRes.data?.claims || []);
          setDisplayTickets(ticketRes.data?.tickets || []);
          break;
        }
        case 'content': {
          const [articleRes, pageRes] = await Promise.all([
            api.request<Record<string, any>>('/articles', { params: { admin: true } }),
            api.request<Record<string, any>>('/admin/page-content'),
          ]);
          setDisplayArticles(articleRes.data?.articles || []);
          setDisplayPageContent(pageRes.data?.pages || []);
          break;
        }
        case 'advertisements': {
          const adRes = await api.request<Record<string, any>>('/admin/advertisements');
          setDisplayAds(adRes.data?.advertisements || []);
          break;
        }
        case 'settings': {
          await fetchOverview();
          break;
        }
        case 'revenue': {
          await fetchOverview();
          break;
        }
        case 'faq': {
          const [faqRes] = await Promise.all([
            api.request<Record<string, any>>('/faqs', { params: { admin: 'true' } }),
          ]);
          setDisplayFaqs(faqRes.data?.faqs || []);
          break;
        }
        case 'careers': {
          const [jobRes] = await Promise.all([
            api.request<Record<string, any>>('/jobs', { params: { admin: 'true' } }),
          ]);
          setDisplayJobs(jobRes.data?.jobs || []);
          break;
        }
        case 'team': {
          const [teamRes] = await Promise.all([
            api.request<Record<string, any>>('/team', { params: { admin: 'true' } }),
          ]);
          setDisplayTeamMembers(teamRes.data?.members || []);
          break;
        }
        case 'brand-kit': {
          const kitRes = await api.request<Record<string, any>>('/admin/brand-kit');
          setDisplayBrandKit(kitRes.data?.brandKit || null);
          setDisplayPressKit(kitRes.data?.pressKit || null);
          break;
        }
        case 'monitoring': {
          const [sysRes, errRes, alertRes] = await Promise.all([
            api.request<Record<string, any>>('/admin/monitoring', { params: { type: 'system' } }),
            api.request<Record<string, any>>('/admin/monitoring', { params: { type: 'errors' } }),
            api.request<Record<string, any>>('/admin/monitoring', { params: { type: 'alerts' } }),
          ]);
          setDisplayMonitoring({ system: sysRes.data, errors: errRes.data, alerts: alertRes.data });
          break;
        }
        case 'webhooks': {
          const [statsRes, eventsRes] = await Promise.all([
            api.request<Record<string, any>>('/admin/webhooks', { params: { type: 'stats' } }),
            api.request<Record<string, any>>('/admin/webhooks', { params: { type: 'events' } }),
          ]);
          setDisplayWebhooks({ stats: statsRes.data, events: eventsRes.data });
          break;
        }
      }
      setDataFetched(prev => ({ ...prev, [section]: true }));
    } catch (err) {
      console.error(`Failed to fetch ${section}:`, err);
      toast.error(`Failed to load ${section} data`);
    } finally {
      setIsLoading(false);
    }
  }, [fetchOverview, userSearch, userRoleFilter, bizStatusFilter, bizSearch, bookingStatusFilter, bookingSearch]);

  // Fetch overview on mount, then fetch section data when section changes
  useEffect(() => {
    if (!isAdmin) return;
    if (!dataFetched['overview']) {
      fetchOverview();
      setDataFetched(prev => ({ ...prev, overview: true }));
    }
  }, [isAdmin, fetchOverview, dataFetched['overview']]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchSectionData(activeSection);
  }, [activeSection, isAdmin]);

  // Re-fetch users when search/filter changes
  useEffect(() => {
    if (activeSection === 'users' && dataFetched['users']) {
      fetchSectionData('users');
    }
  }, [userSearch, userRoleFilter]);

  useEffect(() => {
    if (activeSection === 'businesses' && dataFetched['businesses']) {
      fetchSectionData('businesses');
    }
  }, [bizStatusFilter, bizSearch]);

  useEffect(() => {
    if (activeSection === 'bookings' && dataFetched['bookings']) {
      fetchSectionData('bookings');
    }
  }, [bookingStatusFilter, bookingSearch]);

  // ---- Action handlers ----

  const handleApproveBusiness = async (id: string) => {
    setIsProcessing(true);
    try {
      await api.updateBusinessStatus(id, 'APPROVED');
      setDisplayBusinesses(prev => prev.map(b => b.id === id ? { ...b, verificationStatus: 'APPROVED' } : b));
      toast.success('Business approved successfully');
    } catch (err) {
      console.error('Failed to approve business:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const openRejectModal = (id: string, type: 'business' | 'listing') => {
    setRejectTarget(id);
    setRejectType(type);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleRejectBusiness = async () => {
    if (!rejectTarget || !rejectReason.trim()) { toast.error('Please provide a rejection reason'); return; }
    setIsProcessing(true);
    try {
      if (rejectType === 'business') {
        await api.updateBusinessStatus(rejectTarget, 'REJECTED', rejectReason);
        setDisplayBusinesses(prev => prev.map(b =>
          b.id === rejectTarget ? { ...b, verificationStatus: 'REJECTED' } : b
        ));
        toast.success('Business rejected');
      } else {
        // Reject listing — update status via listings API
        await api.request(`/admin/listings/${rejectTarget}`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'REJECTED', rejectionReason: rejectReason }),
        });
        setDisplayListings(prev => prev.map(l =>
          l.id === rejectTarget ? { ...l, status: 'REJECTED' as any } : l
        ));
        toast.success('Listing rejected');
      }
      setShowRejectModal(false);
      setRejectTarget(null);
      setRejectReason('');
    } catch (err) {
      console.error(`Failed to reject ${rejectType}:`, err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleUser = async (userId: string) => {
    setIsProcessing(true);
    try {
      const u = displayUsers.find(u => u.id === userId);
      const action = u?.status === 'ACTIVE' ? 'suspend' : 'activate';
      await api.request('/admin/users', {
        method: 'PUT',
        body: JSON.stringify({ userId, action, reason: 'Admin action' }),
      });
      setDisplayUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' } : u
      ));
      toast.success(`User ${action === 'suspend' ? 'suspended' : 'activated'} successfully`);
    } catch (err) {
      console.error('Failed to toggle user:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisputeAction = async (action: 'respond' | 'resolve') => {
    if (!selectedDisputeId) return;
    setIsProcessing(true);
    try {
      if (action === 'respond') {
        if (!disputeResponse.trim()) { toast.error('Please enter a message'); setIsProcessing(false); return; }
        await api.request('/admin/disputes', {
          method: 'PUT',
          body: JSON.stringify({ disputeId: selectedDisputeId, status: 'IN_PROGRESS', adminMessage: disputeResponse }),
        });
        setDisplayDisputes(prev => prev.map(d =>
          d.id === selectedDisputeId ? { ...d, status: 'IN_PROGRESS' } : d
        ));
        toast.success('Response sent');
      } else {
        const dispute = displayDisputes.find(d => d.id === selectedDisputeId);
        const amount = resolutionType === 'PARTIAL_REFUND' ? partialRefundAmount : (dispute?.amount || 0);
        await api.request('/admin/disputes', {
          method: 'PUT',
          body: JSON.stringify({
            disputeId: selectedDisputeId, status: 'RESOLVED',
            resolution: { type: resolutionType, amount, notes: resolutionNotes },
          }),
        });
        setDisplayDisputes(prev => prev.map(d =>
          d.id === selectedDisputeId ? { ...d, status: 'RESOLVED', resolution: { type: resolutionType, amount, notes: resolutionNotes } } : d
        ));
        toast.success('Dispute resolved');
      }
      setShowDisputeModal(false);
      setSelectedDisputeId(null);
      setDisputeResponse('');
      setResolutionNotes('');
      setPartialRefundAmount(0);
    } catch (err) {
      console.error('Failed to process dispute:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTicketReply = async () => {
    if (!selectedTicketId || !ticketReply.trim()) { toast.error('Please enter a reply'); return; }
    setIsProcessing(true);
    try {
      await api.request('/admin/tickets', {
        method: 'PUT',
        body: JSON.stringify({ ticketId: selectedTicketId, reply: ticketReply, adminName: user?.name || 'Admin', status: 'IN_PROGRESS' }),
      });
      setDisplayTickets(prev => prev.map(t =>
        t.id === selectedTicketId ? { ...t, status: 'IN_PROGRESS' } : t
      ));
      setShowTicketModal(false);
      setSelectedTicketId(null);
      setTicketReply('');
      toast.success('Reply sent');
    } catch (err) {
      console.error('Failed to send reply:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClaimAction = async () => {
    if (!selectedClaimId || !claimAction) { toast.error('Please select an action'); return; }
    setIsProcessing(true);
    try {
      await api.request('/admin/claims', {
        method: 'PUT',
        body: JSON.stringify({ claimId: selectedClaimId, status: claimAction, adminNotes: claimNotes }),
      });
      setDisplayClaims(prev => prev.map(c =>
        c.id === selectedClaimId ? { ...c, status: claimAction, adminNotes: claimNotes } : c
      ));
      setShowClaimModal(false);
      setSelectedClaimId(null);
      setClaimNotes('');
      setClaimAction('');
      toast.success('Claim updated');
    } catch (err) {
      console.error('Failed to update claim:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveListing = async () => {
    if (!selectedListingId) return;
    setIsProcessing(true);
    try {
      await api.request('/admin/listings', {
        method: 'PUT',
        body: JSON.stringify({ listingId: selectedListingId, ...listingEditData }),
      });
      setDisplayListings(prev => prev.map(l =>
        l.id === selectedListingId ? { ...l, ...listingEditData } : l
      ));
      setShowListingModal(false);
      setSelectedListingId(null);
      toast.success('Listing updated');
    } catch (err) {
      console.error('Failed to save listing:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleListingAction = async (listingId: string, status: string) => {
    setIsProcessing(true);
    try {
      await api.request('/admin/listings', {
        method: 'PUT',
        body: JSON.stringify({ listingId, status }),
      });
      setDisplayListings(prev => prev.map(l =>
        l.id === listingId ? { ...l, status } : l
      ));
      toast.success(`Listing ${status.toLowerCase()}`);
    } catch (err) {
      console.error('Failed to update listing:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSavePageContent = async () => {
    if (!editingPage || !contentEditTitle.trim()) return;
    setIsProcessing(true);
    try {
      await api.request('/admin/page-content', {
        method: 'PUT',
        body: JSON.stringify({ page: editingPage.page, title: contentEditTitle, content: contentEditBody }),
      });
      setDisplayPageContent(prev => prev.map(p =>
        p.id === editingPage.id ? { ...p, title: contentEditTitle, content: contentEditBody } : p
      ));
      setShowContentModal(false);
      setEditingPage(null);
      toast.success('Page content saved');
    } catch (err) {
      console.error('Failed to save page content:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsProcessing(true);
    try {
      await api.request('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      toast.success('Settings saved successfully');
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveWebsiteSettings = async (data: Record<string, any>) => {
    setIsProcessing(true);
    try {
      await api.request('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      toast.success('Website settings saved successfully');
      // Update local settings state
      setSettings(prev => ({ ...prev, ...data }));
    } catch (err) {
      console.error('Failed to save website settings:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // ---- Article CRUD handlers ----

  const generateSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const openArticleModal = (article?: AdminArticle) => {
    if (article) {
      setEditingArticle(article);
      setArticleForm({
        title: article.title || '',
        slug: article.slug || '',
        excerpt: article.excerpt || '',
        content: (article as any).content || '',
        category: article.category || '',
        tags: (article as any).tags || '',
        isFeatured: (article as any).isFeatured || false,
        isPublished: article.status === 'PUBLISHED',
        image: (article as any).image || '',
        readTime: (article as any).readTime || 5,
      });
    } else {
      setEditingArticle(null);
      setArticleForm({ title: '', slug: '', excerpt: '', content: '', category: '', tags: '', isFeatured: false, isPublished: false, image: '', readTime: 5 });
    }
    setShowArticleModal(true);
  };

  const handleSaveArticle = async () => {
    if (!articleForm.title.trim()) { toast.error('Title is required'); return; }
    setIsProcessing(true);
    try {
      const slug = editingArticle ? articleForm.slug : generateSlug(articleForm.title);
      if (editingArticle) {
        await api.request(`/articles/${editingArticle.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            title: articleForm.title,
            slug,
            excerpt: articleForm.excerpt,
            content: articleForm.content,
            category: articleForm.category,
            tags: articleForm.tags,
            isFeatured: articleForm.isFeatured,
            isPublished: articleForm.isPublished,
            image: articleForm.image,
            readTime: articleForm.readTime,
          }),
        });
        toast.success('Article updated');
      } else {
        await api.request('/articles', {
          method: 'POST',
          body: JSON.stringify({
            title: articleForm.title,
            slug,
            excerpt: articleForm.excerpt,
            content: articleForm.content,
            category: articleForm.category,
            tags: articleForm.tags,
            isFeatured: articleForm.isFeatured,
            isPublished: articleForm.isPublished,
            image: articleForm.image,
            readTime: articleForm.readTime,
          }),
        });
        toast.success('Article created');
      }
      setShowArticleModal(false);
      setEditingArticle(null);
      fetchSectionData('content');
    } catch (err) {
      console.error('Failed to save article:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteArticle = async (articleId: string) => {
    if (!confirm('Are you sure you want to delete this article?')) return;
    setIsProcessing(true);
    try {
      await api.request(`/articles/${articleId}`, { method: 'DELETE' });
      setDisplayArticles(prev => prev.filter(a => a.id !== articleId));
      toast.success('Article deleted');
    } catch (err) {
      console.error('Failed to delete article:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // ---- Ad handlers ----

  const openAdModal = (ad?: any) => {
    if (ad) {
      setEditingAd(ad);
      setAdForm({
        businessName: ad.businessName || '',
        contactEmail: ad.contactEmail || '',
        contactPhone: ad.contactPhone || '',
        package: ad.package || 'BASIC',
        duration: ad.duration || 30,
        budget: ad.budget || 0,
        notes: ad.notes || '',
        status: ad.status || 'PENDING',
      });
    } else {
      setEditingAd(null);
      setAdForm({ businessName: '', contactEmail: '', contactPhone: '', package: 'BASIC', duration: 30, budget: 0, notes: '', status: 'PENDING' });
    }
    setShowAdModal(true);
  };

  const handleSaveAd = async () => {
    if (!adForm.businessName.trim()) { toast.error('Business name is required'); return; }
    if (!adForm.contactEmail.trim()) { toast.error('Contact email is required'); return; }
    setIsProcessing(true);
    try {
      if (editingAd) {
        await api.request('/admin/advertisements', {
          method: 'PUT',
          body: JSON.stringify({ advertisementId: editingAd.id, ...adForm }),
        });
        toast.success('Advertisement updated');
      } else {
        await api.request('/admin/advertisements', {
          method: 'POST',
          body: JSON.stringify(adForm),
        });
        toast.success('Advertisement created');
      }
      setShowAdModal(false);
      setEditingAd(null);
      fetchSectionData('advertisements');
    } catch (err) {
      console.error('Failed to save advertisement:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAdStatusChange = async (adId: string, status: string) => {
    setIsProcessing(true);
    try {
      await api.request('/admin/advertisements', {
        method: 'PUT',
        body: JSON.stringify({ advertisementId: adId, status }),
      });
      setDisplayAds(prev => prev.map(ad =>
        ad.id === adId ? { ...ad, status } : ad
      ));
      toast.success(`Advertisement ${status.toLowerCase()}`);
    } catch (err) {
      console.error('Failed to update advertisement status:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // ---- Sidebar configuration ----
  // Structured per spec: Dashboard, Users, Businesses, Bookings, Revenue, Subscriptions, CMS, Reports, Settings

  const sidebarGroups = [
    {
      label: null as string | null,
      items: [
        { id: 'overview' as SectionId, label: 'Dashboard', icon: LayoutDashboard },
        { id: 'users' as SectionId, label: 'Users', icon: Users },
        { id: 'businesses' as SectionId, label: 'Businesses', icon: Building2, count: overviewData?.pending.applications },
        { id: 'bookings' as SectionId, label: 'Bookings', icon: Calendar },
        { id: 'revenue' as SectionId, label: 'Revenue', icon: DollarSign },
      ],
    },
    {
      id: 'subscriptions' as string,
      label: 'Subscriptions',
      icon: Crown,
      items: [
        { id: 'listings' as SectionId, label: 'Premium Listings', icon: Crown, count: overviewData?.pending.listings },
        { id: 'advertisements' as SectionId, label: 'Advertisements', icon: Megaphone, count: overviewData?.pending.ads },
      ],
    },
    {
      id: 'cms' as string,
      label: 'CMS',
      icon: BookOpen,
      items: [
        { id: 'content' as SectionId, label: 'Pages & Blog', icon: Newspaper },
        { id: 'faq' as SectionId, label: 'FAQ', icon: MessageCircle },
        { id: 'careers' as SectionId, label: 'Jobs', icon: Briefcase },
        { id: 'team' as SectionId, label: 'Team', icon: User },
        { id: 'brand-kit' as SectionId, label: 'Brand Kit', icon: Palette },
      ],
    },
    {
      id: 'reports' as string,
      label: 'Reports',
      icon: Flag,
      items: [
        { id: 'disputes-reports' as SectionId, label: 'Disputes & Reports', icon: Gavel, count: (overviewData?.pending.disputes || 0) + (overviewData?.pending.reports || 0) },
        { id: 'claims-support' as SectionId, label: 'Claims & Tickets', icon: LifeBuoy, count: (overviewData?.pending.claims || 0) + (overviewData?.pending.tickets || 0) },
      ],
    },
    {
      id: 'settings-group' as string,
      label: 'Settings',
      icon: Settings,
      items: [
        { id: 'settings' as SectionId, label: 'Platform Settings', icon: Settings },
        { id: 'monitoring' as SectionId, label: 'Monitoring', icon: Activity },
        { id: 'webhooks' as SectionId, label: 'Webhooks', icon: WebhookIcon },
      ],
    },
  ];

  // ---- Access denied ----
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center py-8 px-4">
        <GlassCard className="p-8 text-center max-w-md" hover={false}>
          <Shield className="h-16 w-16 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">You need admin privileges to access this dashboard.</p>
          <GlassButton variant="primary" onClick={() => (window.location.href = '/')}>Go to Home</GlassButton>
        </GlassCard>
      </div>
    );
  }

  // ---- Section title helper ----
  const sectionTitle = sidebarGroups.flatMap(g => g.items).find((i: any) => i.id === activeSection)?.label || '';

  // ============================================
  // RENDER: SIDEBAR
  // ============================================

  const renderSidebar = () => (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        'fixed top-16 left-0 z-30 h-[calc(100vh-4rem)] flex flex-col transition-all duration-300',
        'bg-card/80 backdrop-blur-xl border-r border-white/10',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:translate-x-0',
        sidebarCollapsed ? 'w-[72px]' : 'w-[260px]',
      )}>
        {/* Header */}
        <div className={cn(
          'flex items-center h-16 px-4 border-b border-white/10 shrink-0',
          sidebarCollapsed ? 'justify-center' : 'justify-between',
        )}>
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <BrandLogo variant="icon" size={28} className="pointer-events-none" />
              <BrandLogo variant="wordmark" size={20} className="pointer-events-none" />
            </div>
          )}
          {sidebarCollapsed && (
            <BrandLogo variant="icon" size={28} className="pointer-events-none" />
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className={cn('h-4 w-4 transition-transform', sidebarCollapsed && 'rotate-180')} />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
          {sidebarGroups.map((group) => {
            const isCollapsible = 'id' in group && group.id;
            const isOpen = isCollapsible ? expandedGroups[(group as any).id] !== false : true;
            const GroupIcon = (group as any).icon;
            const hasActiveItem = group.items.some((item: any) => activeSection === item.id);

            return (
              <div key={isCollapsible ? (group as any).id : group.label}>
                {/* Group header — only for collapsible groups */}
                {isCollapsible && !sidebarCollapsed && (
                  <button
                    onClick={() => toggleGroup((group as any).id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-1.5 mb-1 text-[10px] font-semibold uppercase tracking-wider transition-colors rounded-lg',
                      isOpen ? 'text-foreground' : 'text-muted-foreground/60 hover:text-muted-foreground',
                    )}
                  >
                    {GroupIcon && <GroupIcon className="h-3.5 w-3.5" />}
                    <span className="flex-1 text-left">{group.label}</span>
                    <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-180')} />
                  </button>
                )}
                {/* Collapsed group — show as single icon button */}
                {isCollapsible && sidebarCollapsed && (
                  <button
                    onClick={() => toggleGroup((group as any).id)}
                    className={cn(
                      'w-full flex items-center justify-center rounded-xl py-2.5 mb-1 transition-colors',
                      hasActiveItem
                        ? 'gradient-bg text-white shadow-glow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                    )}
                    title={group.label}
                  >
                    {GroupIcon && <GroupIcon className="h-[18px] w-[18px]" />}
                  </button>
                )}
                {/* Items */}
                {(!isCollapsible || isOpen) && (
                  <div className={cn(
                    'space-y-1',
                    isCollapsible && !sidebarCollapsed && 'ml-1',
                  )}>
                    {group.items.map((item: any) => {
                      const isActive = activeSection === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => { setActiveSection(item.id); setSidebarOpen(false); }}
                          className={cn(
                            'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                            sidebarCollapsed && 'justify-center px-0',
                            isActive
                              ? 'gradient-bg text-white shadow-glow-sm'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                          )}
                          title={sidebarCollapsed ? item.label : undefined}
                        >
                          <item.icon className={cn('h-[18px] w-[18px] shrink-0', isActive && 'text-white')} />
                          {!sidebarCollapsed && (
                            <>
                              <span className="flex-1 text-left">{item.label}</span>
                              {item.count !== undefined && item.count > 0 && (
                                <span className={cn(
                                  'min-w-[20px] h-5 flex items-center justify-center rounded-full text-[11px] font-bold px-1.5',
                                  isActive ? 'bg-white/20 text-white' : 'bg-primary/20 text-primary',
                                )}>
                                  {item.count}
                                </span>
                              )}
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        {!sidebarCollapsed && (
          <div className="p-4 border-t border-white/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full gradient-bg flex items-center justify-center text-white font-bold text-sm">
                {user?.name?.charAt(0) || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name || 'Admin'}</p>
                <p className="text-xs text-muted-foreground">Administrator</p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );

  // ============================================
  // RENDER: MAIN CONTENT AREA
  // ============================================

  const renderMainContent = () => (
    <main className={cn(
      'flex-1 min-h-screen transition-all duration-300',
      sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[260px]',
    )}>
      {/* Top bar */}
      <div className="sticky top-16 z-30 h-16 flex items-center justify-between px-4 md:px-6 bg-background/80 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-muted/50 text-muted-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">
            <span className="gradient-text">{sectionTitle}</span>
          </h1>
        </div>
        <button
          onClick={() => fetchSectionData(activeSection)}
          className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors"
          title="Refresh"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            {isLoading && !dataFetched[activeSection] ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-2xl" />
                  ))}
                </div>
                <Skeleton className="h-64 rounded-2xl" />
              </div>
            ) : (
              <>
                {activeSection === 'overview' && renderOverview()}
                {activeSection === 'revenue' && renderRevenue()}
                {activeSection === 'users' && renderUsers()}
                {activeSection === 'businesses' && renderBusinesses()}
                {activeSection === 'bookings' && renderBookings()}
                {activeSection === 'listings' && renderListings()}
                {activeSection === 'disputes-reports' && renderDisputesReports()}
                {activeSection === 'claims-support' && renderClaimsSupport()}
                {activeSection === 'content' && renderContent()}
                {activeSection === 'advertisements' && renderAdvertisements()}
                {activeSection === 'settings' && renderSettings()}
                {activeSection === 'faq' && renderFaq()}
                {activeSection === 'careers' && renderCareers()}
                {activeSection === 'team' && renderTeam()}
                {activeSection === 'brand-kit' && renderBrandKit()}
                {activeSection === 'monitoring' && renderMonitoring()}
                {activeSection === 'webhooks' && renderWebhooks()}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );

  // ============================================
  // SECTION: OVERVIEW
  // ============================================

  const renderOverview = () => {
    const ov = overviewData?.overview;
    const pending = overviewData?.pending;
    const payments = overviewData?.recentPayments || [];
    const chart = overviewData?.revenueChart || [];

    return (
      <div className="space-y-6">
        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: 'Users', value: ov?.totalUsers ?? 0, icon: Users, color: 'blue' },
            { label: 'Businesses', value: ov?.totalBusinesses ?? 0, icon: Building2, color: 'green' },
            { label: 'Bookings', value: ov?.totalBookings ?? 0, icon: Calendar, color: 'purple' },
            { label: 'Revenue', value: fmtCurrency(ov?.totalRevenue), icon: DollarSign, color: 'emerald', isText: true },
            { label: 'Disputes', value: ov?.totalDisputes ?? 0, icon: AlertTriangle, color: 'orange' },
          ].map((stat) => (
            <GlassCard key={stat.label} className="p-4" hover={false}>
              <div className="flex items-center gap-3">
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', `bg-${stat.color}-500/20`)}>
                  <stat.icon className={cn('h-5 w-5', `text-${stat.color}-500`)} />
                </div>
                <div className="min-w-0">
                  <p className={cn('font-bold truncate', stat.isText ? 'text-lg' : 'text-2xl')}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

        {/* Revenue chart + Pending actions */}
        <div className="grid lg:grid-cols-3 gap-6">
          <GlassCard className="lg:col-span-2 p-6" hover={false}>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" /> Revenue Trend
            </h3>
            {chart.length > 0 ? (
              <div className="flex items-end gap-2 h-48">
                {chart.map((item, i) => {
                  const maxVal = Math.max(...chart.map(c => c.revenue), 1);
                  const height = (item.revenue / maxVal) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t-lg gradient-bg min-h-[4px] transition-all"
                        style={{ height: `${Math.max(height, 4)}%` }}
                        title={`${item.month}: ${fmtCurrency(item.revenue)}`}
                      />
                      <span className="text-[10px] text-muted-foreground">{item.month?.slice(0, 3)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-12">No revenue data available</p>
            )}
          </GlassCard>

          <GlassCard className="p-6" hover={false}>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" /> Pending Actions
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Business Applications', count: pending?.applications || 0, section: 'businesses' as SectionId, color: 'yellow' },
                { label: 'Open Disputes', count: pending?.disputes || 0, section: 'disputes-reports' as SectionId, color: 'orange' },
                { label: 'User Reports', count: pending?.reports || 0, section: 'disputes-reports' as SectionId, color: 'red' },
                { label: 'Support Tickets', count: pending?.tickets || 0, section: 'claims-support' as SectionId, color: 'blue' },
                { label: 'Insurance Claims', count: pending?.claims || 0, section: 'claims-support' as SectionId, color: 'purple' },
                { label: 'Listing Requests', count: pending?.listings || 0, section: 'listings' as SectionId, color: 'green' },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => setActiveSection(item.section)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="text-sm">{item.label}</span>
                  <span className={cn(
                    'min-w-[24px] h-6 flex items-center justify-center rounded-full text-xs font-bold px-2',
                    item.count > 0 ? `bg-${item.color}-500/20 text-${item.color}-400` : 'text-muted-foreground',
                  )}>
                    {item.count}
                  </span>
                </button>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Recent payments + Quick actions */}
        <div className="grid lg:grid-cols-3 gap-6">
          <GlassCard className="lg:col-span-2 p-6" hover={false}>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" /> Recent Payments
            </h3>
            {payments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-white/10">
                      <th className="pb-3 font-medium">User</th>
                      <th className="pb-3 font-medium">Amount</th>
                      <th className="pb-3 font-medium">Method</th>
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {payments.slice(0, 8).map((p) => (
                      <tr key={p.id} className="hover:bg-muted/20">
                        <td className="py-3 pr-4">{p.userName || 'N/A'}</td>
                        <td className="py-3 pr-4 font-medium">{fmtCurrency(p.amount)}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{p.method || 'N/A'}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{fmtDate(p.date)}</td>
                        <td className="py-3"><GlassBadge variant={statusColor(p.status)}>{p.status}</GlassBadge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={CreditCard} title="No payments yet" description="Payments will appear here once transactions are made." />
            )}
          </GlassCard>

          <GlassCard className="p-6" hover={false}>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" /> Quick Actions
            </h3>
            <div className="space-y-2">
              {[
                { label: 'Review Applications', section: 'businesses' as SectionId, icon: Building2, color: 'yellow' },
                { label: 'Resolve Disputes', section: 'disputes-reports' as SectionId, icon: Gavel, color: 'orange' },
                { label: 'Manage Listings', section: 'listings' as SectionId, icon: Crown, color: 'purple' },
                { label: 'View Revenue', section: 'revenue' as SectionId, icon: TrendingUp, color: 'green' },
                { label: 'Support Tickets', section: 'claims-support' as SectionId, icon: LifeBuoy, color: 'blue' },
                { label: 'Platform Settings', section: 'settings' as SectionId, icon: Settings, color: 'gray' },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => setActiveSection(item.section)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left',
                    `bg-${item.color}-500/10 hover:bg-${item.color}-500/20`,
                  )}
                >
                  <item.icon className={cn('h-4 w-4', `text-${item.color}-500`)} />
                  <span className="text-sm font-medium">{item.label}</span>
                  <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
                </button>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    );
  };

  // ============================================
  // SECTION: REVENUE
  // ============================================

  const renderRevenue = () => {
    const ov = overviewData?.overview;
    const monthly = overviewData?.monthly;
    const chart = overviewData?.revenueChart || [];

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassCard className="p-5" hover={false}>
            <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
            <p className="text-2xl font-bold">{fmtCurrency(ov?.totalRevenue)}</p>
            {ov && ov.revenueGrowth !== undefined && (
              <div className="flex items-center gap-1 mt-1">
                <ArrowUpRight className={cn('h-3 w-3', ov.revenueGrowth >= 0 ? 'text-green-500' : 'text-red-500')} />
                <span className={cn('text-xs', ov.revenueGrowth >= 0 ? 'text-green-500' : 'text-red-500')}>
                  {ov.revenueGrowth >= 0 ? '+' : ''}{ov.revenueGrowth}%
                </span>
              </div>
            )}
          </GlassCard>
          <GlassCard className="p-5" hover={false}>
            <p className="text-xs text-muted-foreground mb-1">Total Commissions</p>
            <p className="text-2xl font-bold">{fmtCurrency(ov?.totalCommissions)}</p>
          </GlassCard>
          <GlassCard className="p-5" hover={false}>
            <p className="text-xs text-muted-foreground mb-1">Monthly Revenue</p>
            <p className="text-2xl font-bold">{fmtCurrency(monthly?.revenue)}</p>
          </GlassCard>
          <GlassCard className="p-5" hover={false}>
            <p className="text-xs text-muted-foreground mb-1">Monthly Bookings</p>
            <p className="text-2xl font-bold">{monthly?.bookings ?? 0}</p>
          </GlassCard>
        </div>

        {/* Commission breakdown */}
        <GlassCard className="p-6" hover={false}>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-primary" /> Commission Breakdown
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-muted/30">
              <p className="text-xs text-muted-foreground">Platform Fee</p>
              <p className="text-lg font-bold">{settings.platformFee}%</p>
              <p className="text-xs text-muted-foreground mt-1">Current rate</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/30">
              <p className="text-xs text-muted-foreground">This Month</p>
              <p className="text-lg font-bold">{fmtCurrency(monthly?.commissions)}</p>
              <p className="text-xs text-muted-foreground mt-1">Commissions earned</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/30">
              <p className="text-xs text-muted-foreground">Listing Revenue</p>
              <p className="text-lg font-bold">{fmtCurrency(ov?.totalCommissions || 0)}</p>
              <p className="text-xs text-muted-foreground mt-1">Featured & premium</p>
            </div>
          </div>
        </GlassCard>

        {/* Monthly chart */}
        <GlassCard className="p-6" hover={false}>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" /> Monthly Revenue Chart
          </h3>
          {chart.length > 0 ? (
            <div className="flex items-end gap-3 h-64">
              {chart.map((item, i) => {
                const maxVal = Math.max(...chart.map(c => c.revenue), 1);
                const height = (item.revenue / maxVal) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">{fmtCurrency(item.revenue)}</span>
                    <div
                      className="w-full rounded-t-lg gradient-bg min-h-[4px] transition-all"
                      style={{ height: `${Math.max(height, 4)}%` }}
                    />
                    <span className="text-xs text-muted-foreground">{item.month}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={BarChart3} title="No chart data" description="Revenue data will appear once transactions are processed." />
          )}
        </GlassCard>

        {/* Commission Summary */}
        <GlassCard className="p-6" hover={false}>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" /> Commission Summary
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-muted/30">
              <p className="text-xs text-muted-foreground">Total Platform Earnings</p>
              <p className="text-lg font-bold">{fmtCurrency(ov?.totalCommissions)}</p>
              <p className="text-xs text-muted-foreground mt-1">From all commissions</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/30">
              <p className="text-xs text-muted-foreground">Transactions (This Month)</p>
              <p className="text-lg font-bold">{monthly?.bookings ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Completed bookings</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/30">
              <p className="text-xs text-muted-foreground">Avg Transaction Value</p>
              <p className="text-lg font-bold">
                {fmtCurrency(monthly?.bookings ? (monthly?.revenue || 0) / monthly.bookings : 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Revenue / bookings</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/30">
              <p className="text-xs text-muted-foreground">Pending Payouts</p>
              <p className="text-lg font-bold">{(ov as any)?.pendingPayouts ?? 0}</p>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs text-primary cursor-pointer hover:underline">View payouts</span>
                <ChevronRight className="h-3 w-3 text-primary" />
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Earnings by Source */}
        <GlassCard className="p-6" hover={false}>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-primary" /> Earnings by Source
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Booking Commissions', value: (ov as any)?.bookingCommissions ?? ov?.totalCommissions ?? 0, color: 'bg-green-500', pct: 55 },
              { label: 'Premium Listing Revenue', value: (ov as any)?.premiumRevenue ?? (settings.premiumListingPrice * 3), color: 'bg-purple-500', pct: 25 },
              { label: 'Marketing / Boost Revenue', value: (ov as any)?.boostRevenue ?? (settings.featuredListingPrice * 2), color: 'bg-orange-500', pct: 12 },
              { label: 'Subscription Revenue', value: (ov as any)?.subscriptionRevenue ?? 0, color: 'bg-blue-500', pct: 8 },
            ].map((src) => (
              <div key={src.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{src.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{fmtCurrency(src.value)}</span>
                    <span className="text-xs text-muted-foreground">{src.pct}%</span>
                  </div>
                </div>
                <div className="w-full h-2.5 rounded-full bg-muted/30 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', src.color)}
                    style={{ width: `${src.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Recent payments */}
        <GlassCard className="p-6" hover={false}>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" /> Transaction History
          </h3>
          {(overviewData?.recentPayments || []).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-white/10">
                    <th className="pb-3 font-medium">User</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Method</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(overviewData?.recentPayments || []).map((p) => (
                    <tr key={p.id} className="hover:bg-muted/20">
                      <td className="py-3 pr-4">{p.userName || 'N/A'}</td>
                      <td className="py-3 pr-4 font-medium">{fmtCurrency(p.amount)}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{p.method || 'N/A'}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{fmtDate(p.date)}</td>
                      <td className="py-3"><GlassBadge variant={statusColor(p.status)}>{p.status}</GlassBadge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={CreditCard} title="No transactions" description="Transaction history will appear here." />
          )}
        </GlassCard>
      </div>
    );
  };

  // ============================================
  // SECTION: USERS
  // ============================================

  const renderUsers = () => (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <GlassInput
            placeholder="Search users by name, email..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <select
          value={userRoleFilter}
          onChange={(e) => setUserRoleFilter(e.target.value)}
          className="h-11 px-4 rounded-xl border border-border bg-background/50 text-sm text-foreground"
        >
          <option value="">All Roles</option>
          <option value="CUSTOMER">Customer</option>
          <option value="BUSINESS_OWNER">Business Owner</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>

      <GlassCard className="p-6" hover={false}>
        {isLoading && !dataFetched['users'] ? (
          <TableSkeleton />
        ) : displayUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-white/10">
                  <th className="pb-3 font-medium">User</th>
                  <th className="pb-3 font-medium">Role</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Verified</th>
                  <th className="pb-3 font-medium">Joined</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {displayUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/20">
                    <td className="py-3 pr-4">
                      <div>
                        <p className="font-medium">{u.name || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </td>
                    <td className="py-3 pr-4"><GlassBadge variant="default">{u.role}</GlassBadge></td>
                    <td className="py-3 pr-4"><GlassBadge variant={statusColor(u.status)}>{u.status}</GlassBadge></td>
                    <td className="py-3 pr-4">
                      {u.isVerified ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground text-xs">{fmtDate(u.createdAt)}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <GlassButton
                          size="icon"
                          variant="ghost"
                          onClick={() => { setSelectedUserId(u.id); setShowUserModal(true); }}
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </GlassButton>
                        <GlassButton
                          size="sm"
                          variant={u.status === 'ACTIVE' ? 'outline' : 'primary'}
                          onClick={() => handleToggleUser(u.id)}
                          disabled={isProcessing}
                        >
                          {u.status === 'ACTIVE' ? <Ban className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                          {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                        </GlassButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Users} title="No users found" description="Try adjusting your search or filter criteria." />
        )}
      </GlassCard>
    </div>
  );

  // ============================================
  // SECTION: BUSINESSES
  // ============================================

  const renderBusinesses = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <GlassInput
            placeholder="Search businesses..."
            value={bizSearch}
            onChange={(e) => setBizSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <select
          value={bizStatusFilter}
          onChange={(e) => setBizStatusFilter(e.target.value)}
          className="h-11 px-4 rounded-xl border border-border bg-background/50 text-sm text-foreground"
        >
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      <GlassCard className="p-6" hover={false}>
        {isLoading && !dataFetched['businesses'] ? (
          <TableSkeleton />
        ) : displayBusinesses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-white/10">
                  <th className="pb-3 font-medium">Business</th>
                  <th className="pb-3 font-medium">Category</th>
                  <th className="pb-3 font-medium">Owner</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Created</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {displayBusinesses.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/20">
                    <td className="py-3 pr-4">
                      <div>
                        <p className="font-medium">{b.name}</p>
                        <p className="text-xs text-muted-foreground">{b.city || 'N/A'} &middot; {b._count?.services || 0} services</p>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{b.category}</td>
                    <td className="py-3 pr-4">
                      <p className="text-sm">{b.owner?.name || 'N/A'}</p>
                      <p className="text-xs text-muted-foreground">{b.owner?.email}</p>
                    </td>
                    <td className="py-3 pr-4"><GlassBadge variant={statusColor(b.verificationStatus)}>{b.verificationStatus}</GlassBadge></td>
                    <td className="py-3 pr-4 text-muted-foreground text-xs">{fmtDate(b.createdAt)}</td>
                    <td className="py-3 text-right">
                      {b.verificationStatus === 'PENDING' && (
                        <div className="flex items-center justify-end gap-2">
                          <GlassButton size="sm" variant="primary" onClick={() => handleApproveBusiness(b.id)} disabled={isProcessing}>
                            <Check className="h-3 w-3" /> Approve
                          </GlassButton>
                          <GlassButton size="sm" variant="outline" onClick={() => openRejectModal(b.id, 'business')} disabled={isProcessing}>
                            <X className="h-3 w-3" /> Reject
                          </GlassButton>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Building2} title="No businesses found" description="No businesses match your current filters." />
        )}
      </GlassCard>
    </div>
  );

  // ============================================
  // SECTION: BOOKINGS
  // ============================================

  const renderBookings = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <GlassInput
            placeholder="Search bookings..."
            value={bookingSearch}
            onChange={(e) => setBookingSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <select
          value={bookingStatusFilter}
          onChange={(e) => setBookingStatusFilter(e.target.value)}
          className="h-11 px-4 rounded-xl border border-border bg-background/50 text-sm text-foreground"
        >
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="NO_SHOW">No Show</option>
        </select>
      </div>

      <GlassCard className="p-6" hover={false}>
        {isLoading && !dataFetched['bookings'] ? (
          <TableSkeleton />
        ) : displayBookings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-white/10">
                  <th className="pb-3 font-medium">Booking</th>
                  <th className="pb-3 font-medium">Customer</th>
                  <th className="pb-3 font-medium">Business</th>
                  <th className="pb-3 font-medium">Date / Time</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {displayBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/20">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-xs font-mono">{b.id.slice(0, 8)}...</p>
                      <p className="text-xs text-muted-foreground">{b.serviceName || 'N/A'}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-sm">{b.customerName || 'N/A'}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-sm">{b.business?.name || 'N/A'}</p>
                      <p className="text-xs text-muted-foreground">{b.business?.category}</p>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground text-xs">
                      <p>{fmtDate(b.date)}</p>
                      <p>{b.time || 'N/A'}</p>
                    </td>
                    <td className="py-3 pr-4 font-medium">{fmtCurrency(b.totalPrice)}</td>
                    <td className="py-3"><GlassBadge variant={statusColor(b.status)}>{b.status}</GlassBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Calendar} title="No bookings found" description="No bookings match your current filters." />
        )}
      </GlassCard>
    </div>
  );

  // ============================================
  // SECTION: FEATURED LISTINGS
  // ============================================

  const renderListings = () => (
    <div className="space-y-6">
      <GlassCard className="p-6" hover={false}>
        {isLoading && !dataFetched['listings'] ? (
          <TableSkeleton />
        ) : displayListings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-white/10">
                  <th className="pb-3 font-medium">Business</th>
                  <th className="pb-3 font-medium">Plan</th>
                  <th className="pb-3 font-medium">Price</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">End Date</th>
                  <th className="pb-3 font-medium">Impressions</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {displayListings.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/20">
                    <td className="py-3 pr-4 font-medium">{l.businessName || 'N/A'}</td>
                    <td className="py-3 pr-4">
                      <GlassBadge variant={l.plan === 'FEATURED' ? 'primary' : 'secondary'}>{l.plan}</GlassBadge>
                    </td>
                    <td className="py-3 pr-4 font-medium">{fmtCurrency(l.price)}</td>
                    <td className="py-3 pr-4"><GlassBadge variant={statusColor(l.status)}>{l.status}</GlassBadge></td>
                    <td className="py-3 pr-4 text-muted-foreground text-xs">{fmtDate(l.endDate)}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{l.impressions ?? 0}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <GlassButton size="icon" variant="ghost" onClick={() => {
                          setSelectedListingId(l.id);
                          setListingEditData({ plan: l.plan, price: l.price, endDate: l.endDate ? new Date(l.endDate).toISOString().split('T')[0] : '' });
                          setShowListingModal(true);
                        }} title="Edit">
                          <Edit className="h-4 w-4" />
                        </GlassButton>
                        {l.status === 'PENDING' && (
                          <>
                            <GlassButton size="sm" variant="primary" onClick={() => handleListingAction(l.id, 'ACTIVE')} disabled={isProcessing}>
                              <Check className="h-3 w-3" /> Approve
                            </GlassButton>
                            <GlassButton size="sm" variant="outline" onClick={() => openRejectModal(l.id, 'listing')} disabled={isProcessing}>
                              <X className="h-3 w-3" /> Reject
                            </GlassButton>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Crown} title="No listings found" description="No premium listing requests found." />
        )}
      </GlassCard>
    </div>
  );

  // ============================================
  // SECTION: DISPUTES & REPORTS
  // ============================================

  const renderDisputesReports = () => {
    const filteredDisputes = disputeFilter === 'all'
      ? displayDisputes
      : displayDisputes.filter(d => d.status === disputeFilter);

    const filteredReports = reportFilter === 'all'
      ? displayReports
      : displayReports.filter(r => r.status === reportFilter);

    return (
      <div className="space-y-6">
        {/* Disputes */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" /> Disputes
            </h2>
            <select
              value={disputeFilter}
              onChange={(e) => setDisputeFilter(e.target.value)}
              className="h-9 px-3 rounded-lg border border-border bg-background/50 text-sm text-foreground"
            >
              <option value="all">All</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>

          <GlassCard className="p-6" hover={false}>
            {isLoading && !dataFetched['disputes-reports'] ? (
              <TableSkeleton />
            ) : filteredDisputes.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-white/10">
                      <th className="pb-3 font-medium">Dispute</th>
                      <th className="pb-3 font-medium">Customer</th>
                      <th className="pb-3 font-medium">Amount</th>
                      <th className="pb-3 font-medium">Reason</th>
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredDisputes.map((d) => (
                      <tr key={d.id} className="hover:bg-muted/20">
                        <td className="py-3 pr-4">
                          <p className="font-mono text-xs">{d.id.slice(0, 8)}...</p>
                          <p className="text-xs text-muted-foreground">Booking: {d.bookingId?.slice(0, 8)}...</p>
                        </td>
                        <td className="py-3 pr-4">{d.customerName || 'N/A'}</td>
                        <td className="py-3 pr-4 font-medium">{fmtCurrency(d.amount)}</td>
                        <td className="py-3 pr-4 text-muted-foreground max-w-[200px] truncate">{d.reason || d.description || 'N/A'}</td>
                        <td className="py-3 pr-4 text-muted-foreground text-xs">{fmtDate(d.createdAt)}</td>
                        <td className="py-3 pr-4"><GlassBadge variant={statusColor(d.status)}>{d.status}</GlassBadge></td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {d.status !== 'RESOLVED' && (
                              <>
                                <GlassButton size="icon" variant="ghost" onClick={() => {
                                  setSelectedDisputeId(d.id);
                                  setDisputeResponse('');
                                  setShowDisputeModal(true);
                                }} title="Respond">
                                  <MessageSquare className="h-4 w-4" />
                                </GlassButton>
                                <GlassButton size="sm" variant="primary" onClick={() => {
                                  setSelectedDisputeId(d.id);
                                  setResolutionNotes('');
                                  setPartialRefundAmount(d.amount);
                                  setResolutionType('FULL_REFUND');
                                  setShowDisputeModal(true);
                                }} disabled={isProcessing}>
                                  <Check className="h-3 w-3" /> Resolve
                                </GlassButton>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={AlertTriangle} title="No disputes found" description="No disputes match your current filter." />
            )}
          </GlassCard>
        </div>

        {/* Reports */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Flag className="h-5 w-5 text-red-500" /> User Reports
            </h2>
            <select
              value={reportFilter}
              onChange={(e) => setReportFilter(e.target.value)}
              className="h-9 px-3 rounded-lg border border-border bg-background/50 text-sm text-foreground"
            >
              <option value="all">All</option>
              <option value="PENDING">Pending</option>
              <option value="INVESTIGATING">Investigating</option>
              <option value="RESOLVED">Resolved</option>
              <option value="DISMISSED">Dismissed</option>
            </select>
          </div>

          <GlassCard className="p-6" hover={false}>
            {isLoading && !dataFetched['disputes-reports'] ? (
              <TableSkeleton rows={3} />
            ) : filteredReports.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-white/10">
                      <th className="pb-3 font-medium">Reporter</th>
                      <th className="pb-3 font-medium">Reported User</th>
                      <th className="pb-3 font-medium">Type</th>
                      <th className="pb-3 font-medium">Reason</th>
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredReports.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/20">
                        <td className="py-3 pr-4">
                          <p className="text-sm">{r.reporterName || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">{r.reporterId?.slice(0, 8)}</p>
                        </td>
                        <td className="py-3 pr-4">
                          <p className="text-sm">{r.reportedUserName || 'N/A'}</p>
                        </td>
                        <td className="py-3 pr-4"><GlassBadge variant="default">{r.type}</GlassBadge></td>
                        <td className="py-3 pr-4 text-muted-foreground max-w-[200px] truncate">{r.reason}</td>
                        <td className="py-3 pr-4 text-muted-foreground text-xs">{fmtDate(r.createdAt)}</td>
                        <td className="py-3"><GlassBadge variant={statusColor(r.status)}>{r.status}</GlassBadge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={Flag} title="No reports found" description="No reports match your current filter." />
            )}
          </GlassCard>
        </div>
      </div>
    );
  };

  // ============================================
  // SECTION: CLAIMS & SUPPORT
  // ============================================

  const renderClaimsSupport = () => {
    const filteredClaims = claimStatusFilter === 'all'
      ? displayClaims
      : displayClaims.filter(c => c.status === claimStatusFilter);

    const filteredTickets = ticketStatusFilter === 'all'
      ? displayTickets
      : displayTickets.filter(t => t.status === ticketStatusFilter);

    return (
      <div className="space-y-6">
        {/* Claims */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-purple-500" /> Insurance Claims
            </h2>
            <select
              value={claimStatusFilter}
              onChange={(e) => setClaimStatusFilter(e.target.value)}
              className="h-9 px-3 rounded-lg border border-border bg-background/50 text-sm text-foreground"
            >
              <option value="all">All</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="PAID">Paid</option>
            </select>
          </div>

          <GlassCard className="p-6" hover={false}>
            {isLoading && !dataFetched['claims-support'] ? (
              <TableSkeleton />
            ) : filteredClaims.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-white/10">
                      <th className="pb-3 font-medium">Claim #</th>
                      <th className="pb-3 font-medium">Customer</th>
                      <th className="pb-3 font-medium">Type</th>
                      <th className="pb-3 font-medium">Amount</th>
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredClaims.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/20">
                        <td className="py-3 pr-4 font-mono text-xs">{c.claimNumber || c.id.slice(0, 8)}</td>
                        <td className="py-3 pr-4">
                          <p className="text-sm">{c.customerName || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">{c.providerName}</p>
                        </td>
                        <td className="py-3 pr-4"><GlassBadge variant="default">{(c.type || '').replace(/_/g, ' ')}</GlassBadge></td>
                        <td className="py-3 pr-4 font-medium">{fmtCurrency(c.amount)}</td>
                        <td className="py-3 pr-4 text-muted-foreground text-xs">{fmtDate(c.createdAt)}</td>
                        <td className="py-3 pr-4"><GlassBadge variant={statusColor(c.status)}>{(c.status || '').replace(/_/g, ' ')}</GlassBadge></td>
                        <td className="py-3 text-right">
                          {c.status !== 'PAID' && c.status !== 'REJECTED' && (
                            <GlassButton size="sm" variant="outline" onClick={() => {
                              setSelectedClaimId(c.id);
                              setClaimNotes(c.adminNotes || '');
                              setClaimAction('');
                              setShowClaimModal(true);
                            }} disabled={isProcessing}>
                              <Gavel className="h-3 w-3" /> Review
                            </GlassButton>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={ShieldCheck} title="No claims found" description="No insurance claims match your current filter." />
            )}
          </GlassCard>
        </div>

        {/* Support Tickets */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <LifeBuoy className="h-5 w-5 text-blue-500" /> Support Tickets
            </h2>
            <select
              value={ticketStatusFilter}
              onChange={(e) => setTicketStatusFilter(e.target.value)}
              className="h-9 px-3 rounded-lg border border-border bg-background/50 text-sm text-foreground"
            >
              <option value="all">All</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING">Waiting</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          <GlassCard className="p-6" hover={false}>
            {isLoading && !dataFetched['claims-support'] ? (
              <TableSkeleton />
            ) : filteredTickets.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-white/10">
                      <th className="pb-3 font-medium">Ticket</th>
                      <th className="pb-3 font-medium">User</th>
                      <th className="pb-3 font-medium">Subject</th>
                      <th className="pb-3 font-medium">Priority</th>
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredTickets.map((t) => (
                      <tr key={t.id} className="hover:bg-muted/20">
                        <td className="py-3 pr-4 font-mono text-xs">{t.id.slice(0, 8)}...</td>
                        <td className="py-3 pr-4">
                          <p className="text-sm">{t.userName || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">{t.userEmail}</p>
                        </td>
                        <td className="py-3 pr-4 max-w-[200px] truncate font-medium">{t.subject}</td>
                        <td className="py-3 pr-4">
                          <GlassBadge variant={
                            t.priority === 'URGENT' ? 'destructive' :
                            t.priority === 'HIGH' ? 'warning' : 'default'
                          }>
                            {t.priority}
                          </GlassBadge>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground text-xs">{fmtDate(t.createdAt)}</td>
                        <td className="py-3 pr-4"><GlassBadge variant={statusColor(t.status)}>{(t.status || '').replace(/_/g, ' ')}</GlassBadge></td>
                        <td className="py-3 text-right">
                          {t.status !== 'RESOLVED' && t.status !== 'CLOSED' && (
                            <GlassButton size="sm" variant="outline" onClick={() => {
                              setSelectedTicketId(t.id);
                              setTicketReply('');
                              setShowTicketModal(true);
                            }} disabled={isProcessing}>
                              <MessageSquare className="h-3 w-3" /> Reply
                            </GlassButton>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={LifeBuoy} title="No tickets found" description="No support tickets match your current filter." />
            )}
          </GlassCard>
        </div>
      </div>
    );
  };

  // ============================================
  // SECTION: CONTENT
  // ============================================

  const renderContent = () => (
    <div className="space-y-6">
      {/* CMS Pages */}
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Globe className="h-5 w-5 text-primary" /> CMS Pages
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {isLoading && !dataFetched['content'] ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
          ) : displayPageContent.length > 0 ? (
            displayPageContent.map((page) => (
              <GlassCard key={page.id} className="p-5" hover={false}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold mb-1">{page.title}</h3>
                    <p className="text-xs text-muted-foreground capitalize mb-2">{page.page} page</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{(page.content || '').slice(0, 120)}...</p>
                    <p className="text-xs text-muted-foreground mt-2">Updated: {fmtDate(page.updatedAt)}</p>
                  </div>
                  <GlassButton size="icon" variant="ghost" onClick={() => {
                    setEditingPage(page);
                    setContentEditTitle(page.title);
                    setContentEditBody(page.content);
                    setShowContentModal(true);
                  }}>
                    <Edit className="h-4 w-4" />
                  </GlassButton>
                </div>
              </GlassCard>
            ))
          ) : (
            <div className="col-span-2">
              <EmptyState icon={Globe} title="No pages found" description="No CMS pages are available." />
            </div>
          )}
        </div>
      </div>

      {/* Blog Articles */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-primary" /> Blog Articles
            <GlassBadge variant="default">{displayArticles.length}</GlassBadge>
          </h2>
          <GlassButton variant="primary" size="sm" onClick={() => openArticleModal()}>
            <Plus className="h-4 w-4" /> Create Article
          </GlassButton>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Business providers can submit articles for admin approval. Admin can also create official platform content.</p>
        <GlassCard className="p-6" hover={false}>
          {isLoading && !dataFetched['content'] ? (
            <TableSkeleton />
          ) : displayArticles.length > 0 ? (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card/90 backdrop-blur-sm">
                  <tr className="text-left text-muted-foreground border-b border-white/10">
                    <th className="pb-3 font-medium">Title</th>
                    <th className="pb-3 font-medium">Author</th>
                    <th className="pb-3 font-medium">Source</th>
                    <th className="pb-3 font-medium">Category</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Updated</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {displayArticles.map((a) => (
                    <tr key={a.id} className="hover:bg-muted/20">
                      <td className="py-3 pr-4">
                        <p className="font-medium max-w-[250px] truncate">{a.title}</p>
                        <p className="text-xs text-muted-foreground">{a.slug}</p>
                      </td>
                      <td className="py-3 pr-4">{a.author || 'N/A'}</td>
                      <td className="py-3 pr-4">
                        <GlassBadge variant={(a as any).authorType === 'business' ? 'primary' : 'default'}>
                          {(a as any).authorType === 'business' ? 'Provider' : 'Admin'}
                        </GlassBadge>
                      </td>
                      <td className="py-3 pr-4"><GlassBadge variant="default">{a.category || 'N/A'}</GlassBadge></td>
                      <td className="py-3 pr-4"><GlassBadge variant={statusColor(a.status)}>{a.status}</GlassBadge></td>
                      <td className="py-3 pr-4 text-muted-foreground text-xs">{fmtDate(a.updatedAt)}</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1">
                          {a.status === 'PUBLISHED' ? (
                            <GlassButton size="icon" variant="ghost" onClick={async () => {
                              try {
                                await api.request(`/articles/${a.id}`, { method: 'PUT', body: JSON.stringify({ isPublished: false }) });
                                fetchSectionData('content');
                                toast.success('Article unpublished');
                              } catch { toast.error('Failed to unpublish'); }
                            }} title="Unpublish" className="hover:text-yellow-500">
                              <AlertCircle className="h-3.5 w-3.5" />
                            </GlassButton>
                          ) : (
                            <GlassButton size="icon" variant="ghost" onClick={async () => {
                              try {
                                await api.request(`/articles/${a.id}`, { method: 'PUT', body: JSON.stringify({ isPublished: true }) });
                                fetchSectionData('content');
                                toast.success('Article published');
                              } catch { toast.error('Failed to publish'); }
                            }} title="Approve / Publish" className="hover:text-green-500">
                              <CheckCircle className="h-3.5 w-3.5" />
                            </GlassButton>
                          )}
                          <GlassButton size="icon" variant="ghost" onClick={() => openArticleModal(a)} title="Edit">
                            <Edit className="h-3.5 w-3.5" />
                          </GlassButton>
                          <GlassButton size="icon" variant="ghost" onClick={() => handleDeleteArticle(a.id)} title="Delete" className="hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </GlassButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={Newspaper} title="No articles found" description="No blog articles have been created yet." />
          )}
        </GlassCard>
      </div>
    </div>
  );

  // ============================================
  // SECTION: ADVERTISEMENTS
  // ============================================

  const renderAdvertisements = () => (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Ads', value: displayAds.length, icon: Megaphone, color: 'purple' },
          { label: 'Pending', value: displayAds.filter(a => a.status === 'PENDING').length, icon: Clock, color: 'yellow' },
          { label: 'Approved', value: displayAds.filter(a => a.status === 'APPROVED').length, icon: CheckCircle, color: 'green' },
          { label: 'Total Budget', value: fmtCurrency(displayAds.reduce((s, a) => s + (a.budget || 0), 0)), icon: DollarSign, color: 'emerald', isText: true },
        ].map((stat) => (
          <GlassCard key={stat.label} className="p-4" hover={false}>
            <div className="flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', `bg-${stat.color}-500/20`)}>
                <stat.icon className={cn('h-5 w-5', `text-${stat.color}-500`)} />
              </div>
              <div className="min-w-0">
                <p className={cn('font-bold truncate', stat.isText ? 'text-lg' : 'text-2xl')}>{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Ads Table */}
      <GlassCard className="p-6" hover={false}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" /> All Advertisements
          </h3>
          <GlassButton variant="primary" size="sm" onClick={() => openAdModal()}>
            <Plus className="h-4 w-4" /> Create Ad
          </GlassButton>
        </div>
        {isLoading && !dataFetched['advertisements'] ? (
          <TableSkeleton />
        ) : displayAds.length > 0 ? (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card/90 backdrop-blur-sm">
                <tr className="text-left text-muted-foreground border-b border-white/10">
                  <th className="pb-3 font-medium">Business</th>
                  <th className="pb-3 font-medium">Package</th>
                  <th className="pb-3 font-medium">Budget</th>
                  <th className="pb-3 font-medium">Duration</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Created</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {displayAds.map((ad) => (
                  <tr key={ad.id} className="hover:bg-muted/20">
                    <td className="py-3 pr-4">
                      <p className="font-medium">{ad.businessName || 'N/A'}</p>
                      <p className="text-xs text-muted-foreground">{ad.contactEmail || ''}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <GlassBadge variant={ad.package === 'PREMIUM' ? 'default' : ad.package === 'STANDARD' ? 'warning' : 'default'}>
                        {ad.package || 'BASIC'}
                      </GlassBadge>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{fmtCurrency(ad.budget)}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{ad.duration || 0} days</td>
                    <td className="py-3 pr-4">
                      <GlassBadge variant={statusColor(ad.status)}>{ad.status}</GlassBadge>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground text-xs">{fmtDate(ad.createdAt)}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-1">
                        {ad.status === 'PENDING' && (
                          <>
                            <GlassButton size="icon" variant="ghost" onClick={() => handleAdStatusChange(ad.id, 'APPROVED')} title="Approve" className="hover:text-green-500">
                              <Check className="h-3.5 w-3.5" />
                            </GlassButton>
                            <GlassButton size="icon" variant="ghost" onClick={() => handleAdStatusChange(ad.id, 'REJECTED')} title="Reject" className="hover:text-destructive">
                              <X className="h-3.5 w-3.5" />
                            </GlassButton>
                          </>
                        )}
                        <GlassButton size="icon" variant="ghost" onClick={() => openAdModal(ad)} title="Edit">
                          <Edit className="h-3.5 w-3.5" />
                        </GlassButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Megaphone} title="No advertisements found" description="No advertisements have been submitted yet." />
        )}
      </GlassCard>
    </div>
  );

  // ============================================
  // SECTION: SETTINGS
  // ============================================

  const renderSettings = () => (
    <div className="space-y-6 max-w-3xl">
      {/* Platform Fees */}
      <GlassCard className="p-6" hover={false}>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Percent className="h-5 w-5 text-primary" /> Platform Fees
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Platform Fee (%)</label>
            <GlassInput
              type="number"
              value={settings.platformFee}
              onChange={(e) => setSettings(s => ({ ...s, platformFee: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Min Withdrawal (KSh)</label>
            <GlassInput
              type="number"
              value={settings.minWithdrawal}
              onChange={(e) => setSettings(s => ({ ...s, minWithdrawal: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Featured Listing Price (KSh)</label>
            <GlassInput
              type="number"
              value={settings.featuredListingPrice}
              onChange={(e) => setSettings(s => ({ ...s, featuredListingPrice: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Premium Listing Price (KSh)</label>
            <GlassInput
              type="number"
              value={settings.premiumListingPrice}
              onChange={(e) => setSettings(s => ({ ...s, premiumListingPrice: Number(e.target.value) }))}
            />
          </div>
        </div>
      </GlassCard>

      {/* Notification Toggles */}
      <GlassCard className="p-6" hover={false}>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" /> Notifications
        </h3>
        <div className="space-y-4">
          {[
            { key: 'emailNotifications' as const, label: 'Email Notifications', desc: 'Send email notifications to users' },
            { key: 'smsNotifications' as const, label: 'SMS Notifications', desc: 'Send SMS notifications to users' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <button
                onClick={() => setSettings(s => ({ ...s, [item.key]: !s[item.key] }))}
                className={cn(
                  'w-12 h-6 rounded-full transition-colors relative',
                  settings[item.key] ? 'bg-primary' : 'bg-muted',
                )}
              >
                <span className={cn(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                  settings[item.key] ? 'translate-x-6.5 left-0' : 'left-0.5',
                )} />
              </button>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Security Settings */}
      <GlassCard className="p-6" hover={false}>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" /> Security
        </h3>
        <div className="space-y-4">
          {[
            { key: 'requireIdVerification' as const, label: 'Require ID Verification', desc: 'Require users to verify their identity' },
            { key: 'autoApproveBusinesses' as const, label: 'Auto-Approve Businesses', desc: 'Automatically approve new business applications' },
            { key: 'maintenanceMode' as const, label: 'Maintenance Mode', desc: 'Temporarily disable the platform for maintenance' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <button
                onClick={() => setSettings(s => ({ ...s, [item.key]: !s[item.key] }))}
                className={cn(
                  'w-12 h-6 rounded-full transition-colors relative',
                  settings[item.key] ? 'bg-primary' : 'bg-muted',
                )}
              >
                <span className={cn(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                  settings[item.key] ? 'translate-x-6.5 left-0' : 'left-0.5',
                )} />
              </button>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Website Contact Information */}
      <GlassCard className="p-6" hover={false}>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" /> Website Contact Information
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Company Name</label>
            <GlassInput
              placeholder="e.g. Styra"
              value={settings.company_name || ''}
              onChange={(e) => setSettings(s => ({ ...s, company_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Company Tagline</label>
            <GlassInput
              placeholder="e.g. Discover & Book Local Services"
              value={settings.company_tagline || ''}
              onChange={(e) => setSettings(s => ({ ...s, company_tagline: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-muted-foreground block mb-1.5">Company Description</label>
            <textarea
              className="flex w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm backdrop-blur-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[80px] resize-y"
              placeholder="Brief description of your company..."
              value={settings.company_description || ''}
              onChange={(e) => setSettings(s => ({ ...s, company_description: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Support Email</label>
            <GlassInput
              type="email"
              placeholder="support@example.com"
              value={settings.support_email || ''}
              onChange={(e) => setSettings(s => ({ ...s, support_email: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Press Email</label>
            <GlassInput
              type="email"
              placeholder="press@example.com"
              value={settings.press_email || ''}
              onChange={(e) => setSettings(s => ({ ...s, press_email: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Phone Number</label>
            <GlassInput
              type="tel"
              placeholder="+254 700 000 000"
              value={settings.phone || ''}
              onChange={(e) => setSettings(s => ({ ...s, phone: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">WhatsApp Number</label>
            <GlassInput
              type="tel"
              placeholder="+254 700 000 000"
              value={settings.whatsapp_number || ''}
              onChange={(e) => setSettings(s => ({ ...s, whatsapp_number: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-muted-foreground block mb-1.5">Physical Address</label>
            <GlassInput
              placeholder="e.g. Westlands, Nairobi, Kenya"
              value={settings.address || ''}
              onChange={(e) => setSettings(s => ({ ...s, address: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Business Hours</label>
            <GlassInput
              placeholder="e.g. Mon-Fri 9AM-6PM EAT"
              value={settings.business_hours || ''}
              onChange={(e) => setSettings(s => ({ ...s, business_hours: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Support Response Time</label>
            <GlassInput
              placeholder="e.g. Within 24 hours"
              value={settings.support_response_time || ''}
              onChange={(e) => setSettings(s => ({ ...s, support_response_time: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-muted-foreground block mb-1.5">Website URL</label>
            <GlassInput
              type="url"
              placeholder="https://www.example.com"
              value={settings.website_url || ''}
              onChange={(e) => setSettings(s => ({ ...s, website_url: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <p className="text-sm font-medium text-muted-foreground mb-3">Social Media</p>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Instagram</label>
                <GlassInput
                  placeholder="https://instagram.com/..."
                  value={settings.social_instagram || ''}
                  onChange={(e) => setSettings(s => ({ ...s, social_instagram: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Twitter / X</label>
                <GlassInput
                  placeholder="https://x.com/..."
                  value={settings.social_twitter || ''}
                  onChange={(e) => setSettings(s => ({ ...s, social_twitter: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Facebook</label>
                <GlassInput
                  placeholder="https://facebook.com/..."
                  value={settings.social_facebook || ''}
                  onChange={(e) => setSettings(s => ({ ...s, social_facebook: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">TikTok</label>
                <GlassInput
                  placeholder="https://tiktok.com/..."
                  value={settings.social_tiktok || ''}
                  onChange={(e) => setSettings(s => ({ ...s, social_tiktok: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">LinkedIn</label>
                <GlassInput
                  placeholder="https://linkedin.com/..."
                  value={settings.social_linkedin || ''}
                  onChange={(e) => setSettings(s => ({ ...s, social_linkedin: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">YouTube</label>
                <GlassInput
                  placeholder="https://youtube.com/..."
                  value={settings.social_youtube || ''}
                  onChange={(e) => setSettings(s => ({ ...s, social_youtube: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <GlassButton variant="primary" size="sm" onClick={() => handleSaveWebsiteSettings({
            company_name: settings.company_name,
            company_tagline: settings.company_tagline,
            company_description: settings.company_description,
            support_email: settings.support_email,
            press_email: settings.press_email,
            phone: settings.phone,
            whatsapp_number: settings.whatsapp_number,
            address: settings.address,
            business_hours: settings.business_hours,
            support_response_time: settings.support_response_time,
            website_url: settings.website_url,
            social_instagram: settings.social_instagram,
            social_twitter: settings.social_twitter,
            social_facebook: settings.social_facebook,
            social_tiktok: settings.social_tiktok,
            social_linkedin: settings.social_linkedin,
            social_youtube: settings.social_youtube,
          })} isLoading={isProcessing}>
            <Save className="h-4 w-4" /> Save Website Info
          </GlassButton>
        </div>
      </GlassCard>

      <div className="flex justify-end">
        <GlassButton variant="primary" size="lg" onClick={handleSaveSettings} isLoading={isProcessing}>
          <Save className="h-4 w-4" /> Save Settings
        </GlassButton>
      </div>
    </div>
  );

  // ============================================
  // SECTION: FAQ MANAGEMENT
  // ============================================

  const renderFaq = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" /> FAQ Management
          <GlassBadge variant="default">{displayFaqs.length} items</GlassBadge>
        </h2>
        <GlassButton variant="primary" size="sm" onClick={() => toast.info('Create FAQ: coming soon')}>
          <Plus className="h-4 w-4" /> Add FAQ
        </GlassButton>
      </div>
      <GlassCard className="p-6" hover={false}>
        {isLoading && !dataFetched['faq'] ? (
          <TableSkeleton />
        ) : displayFaqs.length > 0 ? (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card/90 backdrop-blur-sm">
                <tr className="text-left text-muted-foreground border-b border-white/10">
                  <th className="pb-3 font-medium">Question</th>
                  <th className="pb-3 font-medium">Answer</th>
                  <th className="pb-3 font-medium">Category</th>
                  <th className="pb-3 font-medium">Published</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {displayFaqs.map((faq: any) => (
                  <tr key={faq.id} className="hover:bg-muted/20">
                    <td className="py-3 pr-4 max-w-[250px]"><p className="font-medium truncate">{faq.question}</p></td>
                    <td className="py-3 pr-4 max-w-[300px]"><p className="text-muted-foreground text-xs line-clamp-2">{faq.answer}</p></td>
                    <td className="py-3 pr-4"><GlassBadge variant="default">{faq.category}</GlassBadge></td>
                    <td className="py-3 pr-4">
                      <GlassBadge variant={faq.isPublished ? 'success' : 'destructive'}>
                        {faq.isPublished ? 'Published' : 'Draft'}
                      </GlassBadge>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-1">
                        <GlassButton size="icon" variant="ghost" onClick={() => toast.info('Edit FAQ: coming soon')} title="Edit">
                          <Edit className="h-3.5 w-3.5" />
                        </GlassButton>
                        <GlassButton size="icon" variant="ghost" onClick={() => {
                          if (confirm('Delete this FAQ?')) {
                            api.request(`/faqs/${faq.id}`, { method: 'DELETE', noRetry: true })
                              .then(() => { setDisplayFaqs(prev => prev.filter((f: any) => f.id !== faq.id)); toast.success('FAQ deleted'); })
                              .catch(() => toast.error('Failed to delete'));
                          }
                        }} title="Delete" className="hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </GlassButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={MessageCircle} title="No FAQs yet" description="Create FAQ items to help your users." />
        )}
      </GlassCard>
    </div>
  );

  // ============================================
  // SECTION: CAREERS MANAGEMENT
  // ============================================

  const renderCareers = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" /> Job Listings
          <GlassBadge variant="default">{displayJobs.length} positions</GlassBadge>
        </h2>
        <GlassButton variant="primary" size="sm" onClick={() => toast.info('Create Job: coming soon')}>
          <Plus className="h-4 w-4" /> Add Job
        </GlassButton>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {isLoading && !dataFetched['careers'] ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)
        ) : displayJobs.length > 0 ? (
          displayJobs.map((job: any) => (
            <GlassCard key={job.id} className="p-5" hover={false}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold truncate">{job.title}</h3>
                    <GlassBadge variant={job.status === 'OPEN' ? 'success' : job.status === 'CLOSED' ? 'destructive' : 'default'}>
                      {job.status}
                    </GlassBadge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                    <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{job.department}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{job.type}</span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>
                  {job._count?.applications > 0 && (
                    <p className="text-xs text-primary mt-2">{job._count.applications} applicant{job._count.applications !== 1 ? 's' : ''}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <GlassButton size="icon" variant="ghost" onClick={() => toast.info('Edit Job: coming soon')} title="Edit">
                    <Edit className="h-4 w-4" />
                  </GlassButton>
                </div>
              </div>
            </GlassCard>
          ))
        ) : (
          <div className="col-span-2">
            <EmptyState icon={Briefcase} title="No jobs listed" description="Create job openings to attract talent." />
          </div>
        )}
      </div>
    </div>
  );

  // ============================================
  // SECTION: TEAM MANAGEMENT
  // ============================================

  const renderTeam = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> Team Members
          <GlassBadge variant="default">{displayTeamMembers.length} members</GlassBadge>
        </h2>
        <GlassButton variant="primary" size="sm" onClick={() => toast.info('Add Team Member: coming soon')}>
          <Plus className="h-4 w-4" /> Add Member
        </GlassButton>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && !dataFetched['team'] ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)
        ) : displayTeamMembers.length > 0 ? (
          displayTeamMembers.map((member: any) => (
            <GlassCard key={member.id} className="p-5" hover={false}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-lg">
                  {member.name?.[0] || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{member.name}</h3>
                  <p className="text-sm text-muted-foreground">{member.role}</p>
                </div>
                <GlassBadge variant={member.isActive ? 'success' : 'destructive'}>
                  {member.isActive ? 'Active' : 'Inactive'}
                </GlassBadge>
              </div>
              {member.bio && <p className="text-sm text-muted-foreground line-clamp-2">{member.bio}</p>}
              <div className="flex justify-end mt-3 gap-1">
                <GlassButton size="icon" variant="ghost" onClick={() => toast.info('Edit Member: coming soon')} title="Edit">
                  <Edit className="h-3.5 w-3.5" />
                </GlassButton>
                <GlassButton size="icon" variant="ghost" onClick={() => {
                  if (confirm('Remove this team member?')) {
                    api.request(`/team/${member.id}`, { method: 'DELETE', noRetry: true })
                      .then(() => { setDisplayTeamMembers(prev => prev.filter((m: any) => m.id !== member.id)); toast.success('Member removed'); })
                      .catch(() => toast.error('Failed to remove'));
                  }
                }} title="Remove" className="hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </GlassButton>
              </div>
            </GlassCard>
          ))
        ) : (
          <div className="col-span-3">
            <EmptyState icon={Users} title="No team members" description="Add team members to display on the About page." />
          </div>
        )}
      </div>
    </div>
  );

  // ============================================
  // SECTION: BRAND KIT
  // ============================================

  const renderBrandKit = () => {
    const handleUpload = (type: 'brand' | 'press') => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.zip,.pdf,.png,.jpg,.jpeg,.svg';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        toast.info(`Uploading ${type} kit...`);
        try {
          await api.request('/admin/brand-kit', {
            method: 'POST',
            body: JSON.stringify({ type, name: file.name, fileSize: file.size, fileType: file.type, fileUrl: `uploads/${file.name}` }),
          });
          toast.success(`${type === 'brand' ? 'Brand' : 'Press'} kit uploaded`);
          fetchSectionData('brand-kit');
        } catch {
          toast.error(`Failed to upload ${type} kit`);
        }
      };
      input.click();
    };

    const handleDelete = async (type: 'brand' | 'press') => {
      if (!confirm(`Delete this ${type} kit?`)) return;
      try {
        await api.request(`/admin/brand-kit?type=${type}`, { method: 'DELETE' });
        if (type === 'brand') setDisplayBrandKit(null);
        else setDisplayPressKit(null);
        toast.success(`${type === 'brand' ? 'Brand' : 'Press'} kit deleted`);
      } catch {
        toast.error('Failed to delete');
      }
    };

    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" /> Brand & Press Kit Management
        </h2>

        {isLoading && !dataFetched['brand-kit'] ? (
          <div className="grid md:grid-cols-2 gap-4">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {/* Brand Kit Card */}
            <GlassCard className="p-6" hover={false}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Palette className="h-5 w-5 text-primary" /> Brand Kit
                </h3>
                <GlassButton variant="primary" size="sm" onClick={() => handleUpload('brand')}>
                  <Plus className="h-4 w-4" /> Upload
                </GlassButton>
              </div>
              {displayBrandKit ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Palette className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{displayBrandKit.name || 'Brand Kit'}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Uploaded {fmtDate(displayBrandKit.createdAt)}
                        {displayBrandKit.fileSize && ` · ${(displayBrandKit.fileSize / 1024).toFixed(1)} KB`}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <GlassButton size="sm" variant="outline" onClick={() => handleDelete('brand')} className="hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </GlassButton>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Palette className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No brand kit uploaded</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Upload brand guidelines, logos, and assets.</p>
                </div>
              )}
            </GlassCard>

            {/* Press Kit Card */}
            <GlassCard className="p-6" hover={false}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Newspaper className="h-5 w-5 text-primary" /> Press Kit
                </h3>
                <GlassButton variant="primary" size="sm" onClick={() => handleUpload('press')}>
                  <Plus className="h-4 w-4" /> Upload
                </GlassButton>
              </div>
              {displayPressKit ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Newspaper className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{displayPressKit.name || 'Press Kit'}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Uploaded {fmtDate(displayPressKit.createdAt)}
                        {displayPressKit.fileSize && ` · ${(displayPressKit.fileSize / 1024).toFixed(1)} KB`}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <GlassButton size="sm" variant="outline" onClick={() => handleDelete('press')} className="hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </GlassButton>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Newspaper className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No press kit uploaded</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Upload press releases, media assets, and info.</p>
                </div>
              )}
            </GlassCard>
          </div>
        )}
      </div>
    );
  };

  // ============================================
  // SECTION: MONITORING
  // ============================================

  const renderMonitoring = () => {
    const sys = displayMonitoring?.system;
    const errs = displayMonitoring?.errors;
    const alerts = displayMonitoring?.alerts;

    return (
      <div className="space-y-6">
        {isLoading && !dataFetched['monitoring'] ? (
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : (
          <>
            {/* System Health */}
            <GlassCard className="p-6" hover={false}>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-500" /> System Health
              </h3>
              {sys ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-muted/30">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="text-lg font-bold text-green-500">{sys.status || 'Healthy'}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/30">
                    <p className="text-xs text-muted-foreground">Environment</p>
                    <p className="text-lg font-bold">{sys.environment || 'development'}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/30">
                    <p className="text-xs text-muted-foreground">DB Size</p>
                    <p className="text-lg font-bold">{sys.database?.sizeMB?.toFixed(1) || '0'} MB</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/30">
                    <p className="text-xs text-muted-foreground">Uptime</p>
                    <p className="text-lg font-bold">{sys.uptime?.approximate || 'N/A'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Unable to load system health data.</p>
              )}
            </GlassCard>

            {/* 24h Activity */}
            {sys?.recentActivity24h && (
              <GlassCard className="p-6" hover={false}>
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" /> Activity (Last 24h)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[
                    { label: 'Bookings', value: sys.recentActivity24h.bookings || 0 },
                    { label: 'Payments', value: sys.recentActivity24h.payments || 0 },
                    { label: 'Alerts', value: sys.recentActivity24h.alerts || 0 },
                    { label: 'Errors', value: sys.recentActivity24h.errors || 0 },
                    { label: 'Webhooks', value: sys.recentActivity24h.webhookEvents || 0 },
                  ].map(stat => (
                    <div key={stat.label} className="p-3 rounded-xl bg-muted/30 text-center">
                      <p className="text-xl font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Recent Errors */}
            <GlassCard className="p-6" hover={false}>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" /> Recent Errors
                {errs?.stats && (
                  <GlassBadge variant={errs.stats.total > 0 ? 'destructive' : 'success'}>
                    {errs.stats.total} total
                  </GlassBadge>
                )}
              </h3>
              {errs?.errors?.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {errs.errors.slice(0, 10).map((err: any, i: number) => (
                    <div key={err.id || i} className="p-3 rounded-lg bg-muted/20 border border-white/5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{err.message || err.errorMessage || 'Unknown error'}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {err.path || err.url || 'N/A'} · {fmtDateTime(err.createdAt || err.timestamp)}
                          </p>
                        </div>
                        {!err.resolved && (
                          <GlassBadge variant="destructive" className="shrink-0">Open</GlassBadge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={CheckCircle} title="No errors" description="System is running smoothly." />
              )}
            </GlassCard>

            {/* Security Alerts */}
            <GlassCard className="p-6" hover={false}>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-red-500" /> Security Alerts
                {alerts?.stats && (
                  <GlassBadge variant={alerts.stats.openAlerts > 0 ? 'destructive' : 'success'}>
                    {alerts.stats.openAlerts} open
                  </GlassBadge>
                )}
              </h3>
              {alerts?.alerts?.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {alerts.alerts.slice(0, 10).map((alert: any, i: number) => (
                    <div key={alert.id || i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-white/5">
                      <div className={cn(
                        'w-2 h-2 rounded-full shrink-0',
                        alert.status === 'OPEN' ? 'bg-red-500' : alert.status === 'INVESTIGATING' ? 'bg-yellow-500' : 'bg-green-500',
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{alert.title || alert.type}</p>
                        <p className="text-xs text-muted-foreground">{alert.severity} · {fmtDateTime(alert.createdAt)}</p>
                      </div>
                      <GlassBadge variant={statusColor(alert.status)}>{alert.status}</GlassBadge>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={ShieldCheck} title="No alerts" description="No security alerts at this time." />
              )}
            </GlassCard>
          </>
        )}
      </div>
    );
  };

  // ============================================
  // SECTION: WEBHOOKS
  // ============================================

  const renderWebhooks = () => {
    const stats = displayWebhooks?.stats;
    const events = displayWebhooks?.events?.events || [];

    return (
      <div className="space-y-6">
        {isLoading && !dataFetched['webhooks'] ? (
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : (
          <>
            {/* Stats */}
            <GlassCard className="p-6" hover={false}>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <WebhookIcon className="h-5 w-5 text-primary" /> Webhook Overview
              </h3>
              {stats ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-muted/30">
                    <p className="text-xs text-muted-foreground">Total Events</p>
                    <p className="text-2xl font-bold">{stats.total || 0}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/30">
                    <p className="text-xs text-muted-foreground">Success Rate</p>
                    <p className="text-2xl font-bold text-green-500">
                      {stats.total > 0 ? (100 - (stats.failureRate || 0)).toFixed(1) : 100}%
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/30">
                    <p className="text-xs text-muted-foreground">Failure Rate</p>
                    <p className="text-2xl font-bold text-red-500">{stats.failureRate || 0}%</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/30">
                    <p className="text-xs text-muted-foreground">Avg Processing</p>
                    <p className="text-2xl font-bold">{stats.avgProcessingTimeMs || 0}ms</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Unable to load webhook stats.</p>
              )}
            </GlassCard>

            {/* By Provider */}
            {stats?.byProvider && Object.keys(stats.byProvider).length > 0 && (
              <GlassCard className="p-6" hover={false}>
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-primary" /> Events by Provider
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(stats.byProvider).map(([provider, count]: [string, any]) => (
                    <div key={provider} className="p-3 rounded-xl bg-muted/30 text-center">
                      <p className="text-xl font-bold">{count}</p>
                      <p className="text-xs text-muted-foreground">{provider}</p>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Recent Events */}
            <GlassCard className="p-6" hover={false}>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" /> Recent Webhook Events
              </h3>
              {events.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b border-white/10">
                        <th className="pb-3 font-medium">Provider</th>
                        <th className="pb-3 font-medium">Event Type</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium">Processing</th>
                        <th className="pb-3 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {events.slice(0, 20).map((evt: any) => (
                        <tr key={evt.id} className="hover:bg-muted/20">
                          <td className="py-3 pr-4 font-medium">{evt.provider || 'N/A'}</td>
                          <td className="py-3 pr-4 text-muted-foreground">{evt.eventType || 'N/A'}</td>
                          <td className="py-3 pr-4">
                            <GlassBadge variant={statusColor(evt.status)}>{evt.status}</GlassBadge>
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {evt.processingTimeMs != null ? `${evt.processingTimeMs}ms` : 'N/A'}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">{fmtDateTime(evt.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState icon={WebhookIcon} title="No webhook events" description="Webhook events will appear here once payment providers send them." />
              )}
            </GlassCard>

            {/* Prune button */}
            <div className="flex justify-end">
              <GlassButton variant="outline" size="sm" onClick={async () => {
                if (!confirm('Prune old webhook events? This removes events older than 30 days.')) return;
                try {
                  await api.request('/admin/webhooks?type=prune', { method: 'POST' });
                  toast.success('Old events pruned');
                  fetchSectionData('webhooks');
                } catch {
                  toast.error('Failed to prune events');
                }
              }}>
                <Trash2 className="h-3.5 w-3.5" /> Prune Old Events
              </GlassButton>
            </div>
          </>
        )}
      </div>
    );
  };

  // ============================================
  // MODALS
  // ============================================

  return (
    <div className="min-h-screen flex">
      {renderSidebar()}
      {renderMainContent()}

      {/* Reject Modal */}
      <GlassModal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)} title="Reject" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Please provide a reason for rejecting this {rejectType === 'business' ? 'business' : 'listing'}.
          </p>
          <textarea
            className="w-full h-24 rounded-xl border border-border bg-background/50 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Enter rejection reason..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <GlassButton variant="ghost" onClick={() => setShowRejectModal(false)}>Cancel</GlassButton>
            <GlassButton variant="outline" onClick={handleRejectBusiness} disabled={isProcessing || !rejectReason.trim()}>
              <X className="h-3 w-3" /> Reject
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* Dispute Modal */}
      <GlassModal isOpen={showDisputeModal} onClose={() => setShowDisputeModal(false)} title="Handle Dispute" size="md">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Admin Message</label>
            <textarea
              className="w-full h-20 rounded-xl border border-border bg-background/50 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Enter your response..."
              value={disputeResponse}
              onChange={(e) => setDisputeResponse(e.target.value)}
            />
          </div>
          <div className="border-t border-white/10 pt-4">
            <label className="text-sm font-medium block mb-1.5">Resolution</label>
            <select
              value={resolutionType}
              onChange={(e) => setResolutionType(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-border bg-background/50 text-sm text-foreground mb-3"
            >
              <option value="FULL_REFUND">Full Refund</option>
              <option value="PARTIAL_REFUND">Partial Refund</option>
              <option value="NO_ACTION">No Action</option>
            </select>
            {resolutionType === 'PARTIAL_REFUND' && (
              <div className="mb-3">
                <label className="text-sm font-medium block mb-1.5">Refund Amount</label>
                <GlassInput
                  type="number"
                  value={partialRefundAmount}
                  onChange={(e) => setPartialRefundAmount(Number(e.target.value))}
                />
              </div>
            )}
            <textarea
              className="w-full h-16 rounded-xl border border-border bg-background/50 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Resolution notes..."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3">
            <GlassButton variant="ghost" onClick={() => setShowDisputeModal(false)}>Cancel</GlassButton>
            <GlassButton variant="outline" onClick={() => handleDisputeAction('respond')} disabled={isProcessing || !disputeResponse.trim()}>
              <Send className="h-3 w-3" /> Send Response
            </GlassButton>
            <GlassButton variant="primary" onClick={() => handleDisputeAction('resolve')} disabled={isProcessing}>
              <Check className="h-3 w-3" /> Resolve
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* Ticket Reply Modal */}
      <GlassModal isOpen={showTicketModal} onClose={() => setShowTicketModal(false)} title="Reply to Ticket" size="md">
        <div className="space-y-4">
          <textarea
            className="w-full h-32 rounded-xl border border-border bg-background/50 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Type your reply..."
            value={ticketReply}
            onChange={(e) => setTicketReply(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <GlassButton variant="ghost" onClick={() => setShowTicketModal(false)}>Cancel</GlassButton>
            <GlassButton variant="primary" onClick={handleTicketReply} disabled={isProcessing || !ticketReply.trim()}>
              <Send className="h-3 w-3" /> Send Reply
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* Claim Review Modal */}
      <GlassModal isOpen={showClaimModal} onClose={() => setShowClaimModal(false)} title="Review Claim" size="md">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Action</label>
            <select
              value={claimAction}
              onChange={(e) => setClaimAction(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-border bg-background/50 text-sm text-foreground"
            >
              <option value="">Select action...</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="APPROVED">Approve</option>
              <option value="REJECTED">Reject</option>
              <option value="PAID">Mark as Paid</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Admin Notes</label>
            <textarea
              className="w-full h-24 rounded-xl border border-border bg-background/50 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Add notes about this claim..."
              value={claimNotes}
              onChange={(e) => setClaimNotes(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3">
            <GlassButton variant="ghost" onClick={() => setShowClaimModal(false)}>Cancel</GlassButton>
            <GlassButton variant="primary" onClick={handleClaimAction} disabled={isProcessing || !claimAction}>
              <Check className="h-3 w-3" /> Update Claim
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* User Detail Modal */}
      <GlassModal isOpen={showUserModal} onClose={() => setShowUserModal(false)} title="User Details" size="md">
        {selectedUserId && (() => {
          const u = displayUsers.find(u => u.id === selectedUserId);
          if (!u) return <p className="text-muted-foreground">User not found</p>;
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Name:</span> <span className="font-medium ml-1">{u.name || 'N/A'}</span></div>
                <div><span className="text-muted-foreground">Email:</span> <span className="font-medium ml-1">{u.email || 'N/A'}</span></div>
                <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium ml-1">{u.phone || 'N/A'}</span></div>
                <div><span className="text-muted-foreground">Role:</span> <span className="font-medium ml-1">{u.role || 'N/A'}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <GlassBadge variant={statusColor(u.status)} className="ml-1">{u.status}</GlassBadge></div>
                <div><span className="text-muted-foreground">Verified:</span> {u.isVerified ? <CheckCircle className="inline h-4 w-4 text-green-500 ml-1" /> : <XCircle className="inline h-4 w-4 text-muted-foreground ml-1" />}</div>
                <div><span className="text-muted-foreground">Joined:</span> <span className="font-medium ml-1">{fmtDate(u.createdAt)}</span></div>
                <div><span className="text-muted-foreground">Total Spent:</span> <span className="font-medium ml-1">{fmtCurrency(u.totalSpent)}</span></div>
                {u.business && (
                  <div className="col-span-2"><span className="text-muted-foreground">Business:</span> <span className="font-medium ml-1">{u.business.name}</span></div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
                <GlassButton variant="ghost" onClick={() => setShowUserModal(false)}>Close</GlassButton>
                <GlassButton
                  variant={u.status === 'ACTIVE' ? 'outline' : 'primary'}
                  onClick={() => { handleToggleUser(u.id); setShowUserModal(false); }}
                  disabled={isProcessing}
                >
                  {u.status === 'ACTIVE' ? <Ban className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                  {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                </GlassButton>
              </div>
            </div>
          );
        })()}
      </GlassModal>

      {/* Listing Edit Modal */}
      <GlassModal isOpen={showListingModal} onClose={() => setShowListingModal(false)} title="Edit Listing" size="md">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Plan</label>
            <select
              value={listingEditData.plan}
              onChange={(e) => setListingEditData(d => ({ ...d, plan: e.target.value }))}
              className="w-full h-10 px-3 rounded-xl border border-border bg-background/50 text-sm text-foreground"
            >
              <option value="FEATURED">Featured</option>
              <option value="PREMIUM">Premium</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Price (KSh)</label>
            <GlassInput
              type="number"
              value={listingEditData.price}
              onChange={(e) => setListingEditData(d => ({ ...d, price: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">End Date</label>
            <GlassInput
              type="date"
              value={listingEditData.endDate}
              onChange={(e) => setListingEditData(d => ({ ...d, endDate: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3">
            <GlassButton variant="ghost" onClick={() => setShowListingModal(false)}>Cancel</GlassButton>
            <GlassButton variant="primary" onClick={handleSaveListing} disabled={isProcessing}>
              <Check className="h-3 w-3" /> Save Changes
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* Content Edit Modal */}
      <GlassModal isOpen={showContentModal} onClose={() => setShowContentModal(false)} title="Edit Page Content" size="xl">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Page Title</label>
            <GlassInput value={contentEditTitle} onChange={(e) => setContentEditTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Content</label>
            <textarea
              className="w-full h-64 rounded-xl border border-border bg-background/50 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={contentEditBody}
              onChange={(e) => setContentEditBody(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3">
            <GlassButton variant="ghost" onClick={() => setShowContentModal(false)}>Cancel</GlassButton>
            <GlassButton variant="primary" onClick={handleSavePageContent} disabled={isProcessing || !contentEditTitle.trim()}>
              <Save className="h-3 w-3" /> Save Content
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* Article Create/Edit Modal */}
      <GlassModal isOpen={showArticleModal} onClose={() => setShowArticleModal(false)} title={editingArticle ? 'Edit Article' : 'Create Article'} size="xl">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {/* Cover Image */}
          <div>
            <label className="text-sm font-medium block mb-1.5">Cover Image</label>
            {articleForm.image ? (
              <div className="relative rounded-xl overflow-hidden mb-2">
                <img src={articleForm.image} alt="Cover" className="w-full h-48 object-cover" />
                <button
                  type="button"
                  onClick={() => setArticleForm(f => ({ ...f, image: '' }))}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = async (e: any) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
                    try {
                      toast.loading('Uploading image...', { id: 'blog-img-upload' });
                      const result = await api.uploadFile(file, 'blog' as any);
                      if (result.data?.url) {
                        setArticleForm(f => ({ ...f, image: result.data.url }));
                        toast.success('Image uploaded', { id: 'blog-img-upload' });
                      } else {
                        toast.error('Upload failed — no URL returned', { id: 'blog-img-upload' });
                      }
                    } catch (err: any) {
                      console.error('Image upload failed:', err);
                      toast.error(err.message || 'Failed to upload image', { id: 'blog-img-upload' });
                    }
                  };
                  input.click();
                }}
              >
                <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Click to upload cover image</p>
                <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB</p>
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Title *</label>
            <GlassInput
              value={articleForm.title}
              onChange={(e) => {
                const title = e.target.value;
                setArticleForm(f => ({
                  ...f,
                  title,
                  slug: editingArticle ? f.slug : generateSlug(title),
                }));
              }}
              placeholder="Article title"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Slug</label>
            <GlassInput
              value={articleForm.slug}
              onChange={(e) => setArticleForm(f => ({ ...f, slug: e.target.value }))}
              placeholder="auto-generated-from-title"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Excerpt</label>
            <textarea
              className="w-full h-20 rounded-xl border border-border bg-background/50 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={articleForm.excerpt}
              onChange={(e) => setArticleForm(f => ({ ...f, excerpt: e.target.value }))}
              placeholder="Brief summary..."
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Content</label>
            <textarea
              className="w-full h-48 rounded-xl border border-border bg-background/50 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={articleForm.content}
              onChange={(e) => setArticleForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Article body..."
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">Category</label>
              <select
                value={articleForm.category}
                onChange={(e) => setArticleForm(f => ({ ...f, category: e.target.value }))}
                className="w-full h-10 px-3 rounded-xl border border-border bg-background/50 text-sm text-foreground"
              >
                <option value="">Select category</option>
                <option value="Grooming Tips">Grooming Tips</option>
                <option value="Style Guide">Style Guide</option>
                <option value="Trends">Trends</option>
                <option value="Business">Business</option>
                <option value="Platform Updates">Platform Updates</option>
                <option value="General">General</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Tags (comma-separated)</label>
              <GlassInput
                value={articleForm.tags}
                onChange={(e) => setArticleForm(f => ({ ...f, tags: e.target.value }))}
                placeholder="grooming, style, tips"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Read Time (minutes)</label>
              <GlassInput
                type="number"
                min={1}
                value={articleForm.readTime}
                onChange={(e) => setArticleForm(f => ({ ...f, readTime: parseInt(e.target.value) || 5 }))}
                placeholder="5"
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={articleForm.isFeatured}
                onChange={(e) => setArticleForm(f => ({ ...f, isFeatured: e.target.checked }))}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/50"
              />
              <span className="text-sm">Featured Article</span>
              <Star className="h-3.5 w-3.5 text-yellow-500" />
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={articleForm.isPublished}
                onChange={(e) => setArticleForm(f => ({ ...f, isPublished: e.target.checked }))}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/50"
              />
              <span className="text-sm">Published</span>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
            <GlassButton variant="ghost" onClick={() => setShowArticleModal(false)}>Cancel</GlassButton>
            <GlassButton variant="primary" onClick={handleSaveArticle} disabled={isProcessing || !articleForm.title.trim()}>
              {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              {editingArticle ? 'Update Article' : 'Create Article'}
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* Advertisement Create/Edit Modal */}
      <GlassModal isOpen={showAdModal} onClose={() => setShowAdModal(false)} title={editingAd ? 'Edit Advertisement' : 'Create Advertisement'} size="md">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Business Name *</label>
            <GlassInput
              value={adForm.businessName}
              onChange={(e) => setAdForm(f => ({ ...f, businessName: e.target.value }))}
              placeholder="Business name"
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">Contact Email *</label>
              <GlassInput
                type="email"
                value={adForm.contactEmail}
                onChange={(e) => setAdForm(f => ({ ...f, contactEmail: e.target.value }))}
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Contact Phone</label>
              <GlassInput
                value={adForm.contactPhone}
                onChange={(e) => setAdForm(f => ({ ...f, contactPhone: e.target.value }))}
                placeholder="+254 700 000 000"
              />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">Package</label>
              <select
                value={adForm.package}
                onChange={(e) => setAdForm(f => ({ ...f, package: e.target.value }))}
                className="w-full h-10 px-3 rounded-xl border border-border bg-background/50 text-sm text-foreground"
              >
                <option value="BASIC">Basic</option>
                <option value="STANDARD">Standard</option>
                <option value="PREMIUM">Premium</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Duration (days)</label>
              <GlassInput
                type="number"
                value={adForm.duration}
                onChange={(e) => setAdForm(f => ({ ...f, duration: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Budget (KSh)</label>
            <GlassInput
              type="number"
              value={adForm.budget}
              onChange={(e) => setAdForm(f => ({ ...f, budget: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Notes</label>
            <textarea
              className="w-full h-20 rounded-xl border border-border bg-background/50 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={adForm.notes}
              onChange={(e) => setAdForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Additional notes..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
            <GlassButton variant="ghost" onClick={() => setShowAdModal(false)}>Cancel</GlassButton>
            <GlassButton variant="primary" onClick={handleSaveAd} disabled={isProcessing || !adForm.businessName.trim() || !adForm.contactEmail.trim()}>
              {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              {editingAd ? 'Update Ad' : 'Create Ad'}
            </GlassButton>
          </div>
        </div>
      </GlassModal>
    </div>
  );
};
