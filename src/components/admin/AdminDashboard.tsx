'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Users,
  Building2,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Search,
  ChevronDown,
  Mail,
  Phone,
  MapPin,
  AlertTriangle,
  Check,
  X,
  Loader2,
  Calendar,
  DollarSign,
  TrendingUp,
  Settings,
  BarChart3,
  Activity,
  Bell,
  Lock,
  Percent,
  ToggleLeft,
  ToggleRight,
  Download,
  RefreshCw,
  MessageSquare,
  AlertCircle,
  Star,
  CreditCard,
  Package,
  Crown,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  LineChart,
  Ban,
  UserCheck,
  FileText,
  Send,
  Globe,
  Newspaper,
  Megaphone,
  Flag,
  UserX,
  LifeBuoy,
  ClipboardCheck,
  Heart,
  ThumbsUp,
  Edit,
  Trash2,
  Plus,
  Filter,
  MoreHorizontal,
  ShieldCheck,
  Unlock,
  Inbox,
  FileWarning,
  User,
  Tag,
} from 'lucide-react';
import {
  GlassCard,
  GlassButton,
  GlassInput,
  GlassBadge,
  FadeIn,
} from '@/components/ui/custom/glass-components';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/ui/brand-logo';
import { useAuthStore, useBusinessStore } from '@/store';
import api from '@/lib/api-client';
import { toast } from 'sonner';

type TabType = 'overview' | 'pending' | 'approved' | 'rejected' | 'users' | 'analytics' | 'disputes' | 'listings' | 'revenue' | 'settings' | 'articles' | 'advertising' | 'reports' | 'blocked' | 'support' | 'claims' | 'page-content';

// ============================================
// ARTICLE/BLOG TYPES
// ============================================
interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author: string;
  authorId: string;
  category: string;
  tags: string[];
  status: 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'REJECTED';
  views: number;
  likes: number;
  featuredImage?: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  adminNotes?: string;
}

// ============================================
// ADVERTISING/MARKETING TYPES
// ============================================
interface AdRequest {
  id: string;
  businessName: string;
  businessId: string;
  contactEmail: string;
  contactPhone: string;
  package: 'BASIC' | 'PREMIUM' | 'FEATURED' | 'CUSTOM';
  duration: number; // days
  budget: number;
  startDate: Date;
  endDate?: Date;
  status: 'PENDING' | 'APPROVED' | 'ACTIVE' | 'COMPLETED' | 'REJECTED';
  impressions: number;
  clicks: number;
  conversions: number;
  notes?: string;
  createdAt: Date;
  adminNotes?: string;
}

// ============================================
// REPORT TYPES
// ============================================
interface Report {
  id: string;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  reportedUserId: string;
  reportedUserName: string;
  reportedUserEmail: string;
  type: 'USER' | 'BUSINESS' | 'REVIEW' | 'MESSAGE' | 'OTHER';
  reason: string;
  description: string;
  evidence?: string[]; // URLs to screenshots etc
  status: 'PENDING' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';
  createdAt: Date;
  resolvedAt?: Date;
  adminNotes?: string;
  action?: 'WARNING' | 'SUSPENSION' | 'BAN' | 'NO_ACTION';
}

// ============================================
// BLOCKED USER TYPES
// ============================================
interface BlockedUser {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  blockedBy: string;
  blockedAt: Date;
  reason: string;
  originalReportId?: string;
  appealStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  appealReason?: string;
  appealDate?: Date;
  unblockScheduledAt?: Date;
  adminNotes?: string;
}

// ============================================
// SUPPORT MESSAGE TYPES
// ============================================
interface SupportMessage {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  subject: string;
  message: string;
  category: 'GENERAL' | 'TECHNICAL' | 'BILLING' | 'COMPLAINT' | 'FEEDBACK' | 'OTHER';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';
  replies: { id: string; from: 'USER' | 'ADMIN'; message: string; createdAt: Date; adminName?: string }[];
  createdAt: Date;
  updatedAt: Date;
  assignedTo?: string;
}

// ============================================
// PAGE CONTENT TYPES
// ============================================
interface PageContent {
  id: string;
  page: 'about' | 'privacy' | 'terms' | 'safety';
  title: string;
  content: string;
  lastUpdated: Date;
  updatedBy: string;
}

// ============================================
// INSURANCE CLAIM TYPES
// ============================================
interface InsuranceClaim {
  id: string;
  claimNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  providerId: string;
  providerName: string;
  bookingId: string;
  type: 'INJURY' | 'DAMAGE' | 'ALLERGIC_REACTION' | 'OTHER';
  description: string;
  amount: number;
  currency: string;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'PAID';
  documents?: string[];
  incidentDate: Date;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  adminNotes?: string;
  resolution?: string;
}

// Dispute type
interface Dispute {
  id: string;
  bookingId: string;
  customerId: string;
  customerName: string;
  providerId: string;
  providerName: string;
  type: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  createdAt: Date;
  amount: number;
  resolution?: { type: 'FULL_REFUND' | 'PARTIAL_REFUND' | 'NO_ACTION'; amount: number; notes: string };
  resolvedAt?: Date;
}

interface AdminDashboardProps {
  initialTab?: TabType;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ initialTab = 'overview' }) => {
  const { user } = useAuthStore();
  const { businesses } = useBusinessStore();

  // API applications state (replaces Zustand admin store)
  const [apiApplications, setApiApplications] = useState<any[]>([]);
  
  // CRITICAL: Role-based access control - only ADMIN can access
  const isAdmin = user?.roles?.includes('ADMIN') || user?.role === 'ADMIN';
  
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApplication, setSelectedApplication] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<string | null>(null);
  const [disputeResponse, setDisputeResponse] = useState('');
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [premiumListings, setPremiumListings] = useState<any[]>([]);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionType, setResolutionType] = useState<'FULL_REFUND' | 'PARTIAL_REFUND' | 'NO_ACTION'>('FULL_REFUND');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [partialRefundAmount, setPartialRefundAmount] = useState(0);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedListing, setSelectedListing] = useState<string | null>(null);
  const [showListingModal, setShowListingModal] = useState(false);
  const [listingEditData, setListingEditData] = useState({
    plan: 'FEATURED',
    price: 99,
    endDate: '',
  });

  // Settings state
  const [settings, setSettings] = useState({
    platformFee: 15,
    minWithdrawal: 50,
    maintenanceMode: false,
    emailNotifications: true,
    smsNotifications: false,
    autoApprove: false,
    requireIdVerification: true,
    featuredListingPrice: 99,
    premiumListingPrice: 49,
  });

  // API Data states
  const [apiUsers, setApiUsers] = useState<any[]>([]);
  const [apiReports, setApiReports] = useState<Report[]>([]);
  const [apiBans, setApiBans] = useState<BlockedUser[]>([]);
  const [apiTickets, setApiTickets] = useState<SupportMessage[]>([]);
  const [apiClaims, setApiClaims] = useState<InsuranceClaim[]>([]);
  const [apiArticles, setApiArticles] = useState<Article[]>([]);
  const [apiAds, setApiAds] = useState<AdRequest[]>([]);
  const [apiListings, setApiListings] = useState<any[]>([]);
  const [apiDisputes, setApiDisputes] = useState<Dispute[]>([]);
  const [apiPageContent, setApiPageContent] = useState<PageContent[]>([]);
  const [overviewData, setOverviewData] = useState<{
    overview: { totalUsers: number; totalBusinesses: number; totalBookings: number; totalRevenue: number; totalCommissions: number; revenueGrowth: number };
    monthly: { revenue: number; commissions: number; bookings: number };
    pending: { applications: number; reports: number; disputes: number; listings: number; tickets: number; claims: number; ads: number };
    revenueChart: { month: string; revenue: number }[];
    settings: typeof settings;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dataFetched, setDataFetched] = useState(false);

  // Fetch overview data
  const fetchOverview = useCallback(async () => {
    try {
      const data = await api.request<Record<string, any>>('/admin/overview');
      const d = data.data;
      setOverviewData(d as NonNullable<typeof overviewData>);
      if (d?.settings) {
        setSettings({
          platformFee: data.data.settings.platformFee || 15,
          minWithdrawal: data.data.settings.minWithdrawal || 50,
          maintenanceMode: data.data.settings.maintenanceMode || false,
          emailNotifications: data.data.settings.emailNotifications ?? true,
          smsNotifications: data.data.settings.smsNotifications || false,
          autoApprove: data.data.settings.autoApproveBusinesses || false,
          requireIdVerification: data.data.settings.requireIdVerification ?? true,
          featuredListingPrice: data.data.settings.featuredListingPrice || 99,
          premiumListingPrice: data.data.settings.premiumListingPrice || 49,
        });
      }
    } catch (error) {
      console.error('Failed to fetch overview:', error);
    }
  }, []);

  // Fetch data on mount and when tab changes
  useEffect(() => {
    if (!dataFetched) {
      setIsLoading(true);
      fetchOverview().finally(() => {
        setIsLoading(false);
        setDataFetched(true);
      });
    }
  }, [dataFetched, fetchOverview]);

  // Fetch tab-specific data
  useEffect(() => {
    const fetchTabData = async () => {
      try {
        switch (activeTab) {
          case 'users':
            {
              const res = await api.request<Record<string, any>>('/admin/users');
              setApiUsers(res.data?.users || []);
            }
            break;
          case 'reports':
            {
              const res = await api.request<Record<string, any>>('/admin/reports');
              setApiReports(res.data?.reports || []);
            }
            break;
          case 'blocked':
            {
              const res = await api.request<Record<string, any>>('/admin/bans');
              setApiBans(res.data?.bans || []);
            }
            break;
          case 'support':
            {
              const res = await api.request<Record<string, any>>('/admin/tickets');
              setApiTickets(res.data?.tickets || []);
            }
            break;
          case 'claims':
            {
              const res = await api.request<Record<string, any>>('/admin/claims');
              setApiClaims(res.data?.claims || []);
            }
            break;
          case 'articles':
            {
              const res = await api.request<Record<string, any>>('/articles', { params: { admin: true } });
              setApiArticles(res.data?.articles || []);
            }
            break;
          case 'advertising':
            {
              const res = await api.request<Record<string, any>>('/admin/advertisements');
              setApiAds(res.data?.advertisements || []);
            }
            break;
          case 'listings':
            {
              const res = await api.request<Record<string, any>>('/admin/listings');
              setApiListings(res.data?.listings || []);
            }
            break;
          case 'disputes':
            {
              const res = await api.request<Record<string, any>>('/admin/disputes');
              setApiDisputes(res.data?.disputes || []);
            }
            break;
          case 'page-content':
            {
              const res = await api.request<Record<string, any>>('/admin/page-content');
              setApiPageContent(res.data?.pages || []);
            }
            break;
          case 'pending':
          case 'approved':
          case 'rejected':
            {
              const statusMap: Record<string, string> = { pending: 'PENDING', approved: 'APPROVED', rejected: 'REJECTED' };
              const res = await api.request<Record<string, any>>('/admin/businesses', { params: { status: statusMap[activeTab] } });
              setApiApplications(res.data?.data || []);
            }
            break;
        }
      } catch (error) {
        console.error(`Failed to fetch ${activeTab} data:`, error);
      }
    };

    if (dataFetched && activeTab !== 'overview' && activeTab !== 'settings') {
      fetchTabData();
    }
  }, [activeTab, dataFetched]);

  // Early return AFTER all hooks
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center py-8 px-4">
        <GlassCard className="p-8 text-center max-w-md">
          <Shield className="h-16 w-16 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">
            You need admin privileges to access this dashboard.
          </p>
          <GlassButton variant="primary" onClick={() => window.location.href = '/'}>
            Go to Home
          </GlassButton>
        </GlassCard>
      </div>
    );
  }

  // Use API data
  const displayUsers = apiUsers;
  const displayReports = apiReports;
  const displayBans = apiBans;
  const displayTickets = apiTickets;
  const displayClaims = apiClaims;
  const displayArticles = apiArticles;
  const displayAds = apiAds;
  const displayListings = apiListings;
  const displayDisputes = apiDisputes;
  const displayPageContent = apiPageContent;

  // Handle user suspend/activate
  const handleToggleUserStatus = async (userId: string) => {
    setIsProcessing(true);
    try {
      const foundUser = displayUsers.find(u => u.id === userId);
      const action = foundUser?.status === 'ACTIVE' ? 'suspend' : 'activate';
      
      await api.request('/admin/users', {
        method: 'PUT',
        body: JSON.stringify({ userId, action, reason: 'Admin action', adminId: user?.id || 'admin' }),
      });
      
      setApiUsers(prev => prev.map(u => 
        u.id === userId 
          ? { ...u, status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }
          : u
      ));
      toast.success(`User ${action === 'suspend' ? 'suspended' : 'activated'} successfully`);
    } catch (error) {
      console.error('Failed to update user status:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle view user
  const handleViewUser = (userId: string) => {
    setSelectedUser(userId);
    setShowUserModal(true);
  };

  // Handle view listing details
  const handleViewListing = (listingId: string) => {
    setSelectedListing(listingId);
    setShowListingModal(true);
  };

  // Handle edit listing
  const handleEditListing = (listingId: string) => {
    const listing = premiumListings.find(l => l.id === listingId);
    if (listing) {
      setSelectedListing(listingId);
      setListingEditData({
        plan: listing.plan,
        price: listing.price,
        endDate: listing.endDate.toISOString().split('T')[0],
      });
      setShowListingModal(true);
    }
  };

  // Handle save listing changes
  const handleSaveListing = async () => {
    if (!selectedListing) return;
    setIsProcessing(true);
    try {
      await api.request('/admin/listings', {
        method: 'PUT',
        body: JSON.stringify({
          listingId: selectedListing,
          plan: listingEditData.plan,
          price: listingEditData.price,
          endDate: listingEditData.endDate,
        }),
      });
      setApiListings(prev => prev.map(l =>
        l.id === selectedListing
          ? {
              ...l,
              plan: listingEditData.plan as 'FEATURED' | 'PREMIUM',
              price: listingEditData.price,
              endDate: new Date(listingEditData.endDate),
            }
          : l
      ));
      setShowListingModal(false);
      setSelectedListing(null);
      toast.success('Listing updated successfully');
    } catch (error) {
      console.error('Failed to save listing:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle send dispute response
  const handleSendDisputeResponse = async () => {
    if (!selectedDispute || !disputeResponse.trim()) return;
    setIsProcessing(true);
    try {
      await api.request('/admin/disputes', {
        method: 'PUT',
        body: JSON.stringify({
          disputeId: selectedDispute,
          status: 'IN_PROGRESS',
          adminMessage: disputeResponse,
        }),
      });
      setApiDisputes(prev => prev.map(d =>
        d.id === selectedDispute
          ? { ...d, status: 'IN_PROGRESS' as const }
          : d
      ));
      setShowDisputeModal(false);
      setDisputeResponse('');
      setSelectedDispute(null);
      toast.success('Response sent successfully');
    } catch (error) {
      console.error('Failed to send response:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter applications by status (from API data)
  const pendingApps = apiApplications.filter((app: any) => app.verificationStatus === 'PENDING');
  const approvedApps = apiApplications.filter((app: any) => app.verificationStatus === 'APPROVED');
  const rejectedApps = apiApplications.filter((app: any) => app.verificationStatus === 'REJECTED');

  // Filter by search
  const filterBySearch = (apps: any[]) => {
    if (!searchQuery) return apps;
    const query = searchQuery.toLowerCase();
    return apps.filter(app => 
      (app.name || app.businessName || '').toLowerCase().includes(query) ||
      (app.owner?.name || app.userName || '').toLowerCase().includes(query) ||
      (app.owner?.email || app.userEmail || '').toLowerCase().includes(query)
    );
  };

  // Stats - use API data when available
  const stats = {
    totalUsers: overviewData?.overview.totalUsers || displayUsers.length,
    totalBusinesses: overviewData?.overview.totalBusinesses || businesses.length || 0,
    pendingApprovals: overviewData?.pending.applications || pendingApps.length,
    totalRevenue: overviewData?.overview.totalRevenue || 0,
    activeBookings: overviewData?.monthly.bookings || 0,
    monthlyGrowth: overviewData?.overview.revenueGrowth || 0,
    totalTransactions: 0,
    // TODO: Fetch avg rating from API when available
    avgRating: 0,
    openDisputes: overviewData?.pending.disputes || displayDisputes.filter(d => d.status === 'OPEN').length,
    activeListings: overviewData?.pending.listings || displayListings.filter(l => l.status === 'ACTIVE').length,
  };

  const handleApprove = async (applicationId: string) => {
    setIsProcessing(true);
    try {
      await api.updateBusinessStatus(applicationId, 'APPROVED');
      setApiApplications(prev => prev.map(app =>
        app.id === applicationId
          ? { ...app, verificationStatus: 'APPROVED' }
          : app
      ));
      setSelectedApplication(null);
      toast.success('Business approved successfully');
    } catch (error) {
      console.error('Failed to approve:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApplication || !rejectReason.trim()) return;
    
    setIsProcessing(true);
    try {
      await api.updateBusinessStatus(selectedApplication, 'REJECTED', rejectReason);
      setApiApplications(prev => prev.map(app =>
        app.id === selectedApplication
          ? { ...app, verificationStatus: 'REJECTED', rejectionReason: rejectReason }
          : app
      ));
      setShowRejectModal(false);
      setSelectedApplication(null);
      setRejectReason('');
      toast.success('Business rejected');
    } catch (error) {
      console.error('Failed to reject:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle dispute resolution
  const handleResolveDispute = async () => {
    if (!selectedDispute) return;
    
    setIsProcessing(true);
    try {
      await api.request('/admin/disputes', {
        method: 'PUT',
        body: JSON.stringify({
          disputeId: selectedDispute,
          status: 'RESOLVED',
          resolution: {
            type: resolutionType,
            amount: resolutionType === 'PARTIAL_REFUND' ? partialRefundAmount : displayDisputes.find(d => d.id === selectedDispute)?.amount || 0,
            notes: resolutionNotes,
          },
        }),
      });
      
      setApiDisputes(prev => prev.map(d => 
        d.id === selectedDispute 
          ? { 
              ...d, 
              status: 'RESOLVED' as const,
              resolution: {
                type: resolutionType,
                amount: resolutionType === 'PARTIAL_REFUND' ? partialRefundAmount : d.amount,
                notes: resolutionNotes,
              }
            } 
          : d
      ));
      setShowResolveModal(false);
      setSelectedDispute(null);
      setResolutionNotes('');
      setPartialRefundAmount(0);
      toast.success('Dispute resolved successfully');
    } catch (error) {
      console.error('Failed to resolve dispute:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle refund
  const handleRefund = async (disputeId: string, amount: number) => {
    setIsProcessing(true);
    try {
      await api.request('/admin/disputes', {
        method: 'PUT',
        body: JSON.stringify({
          disputeId,
          status: 'RESOLVED',
          resolution: { type: 'FULL_REFUND', amount, notes: 'Full refund processed' },
        }),
      });
      setApiDisputes(prev => prev.map(d => 
        d.id === disputeId 
          ? { ...d, status: 'RESOLVED' as const, resolution: { type: 'FULL_REFUND', amount, notes: 'Full refund processed' } }
          : d
      ));
      toast.success('Full refund processed successfully');
    } catch (error) {
      console.error('Failed to process refund:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle listing approval
  const handleApproveListing = async (listingId: string) => {
    setIsProcessing(true);
    try {
      await api.request('/admin/listings', {
        method: 'PUT',
        body: JSON.stringify({ listingId, status: 'ACTIVE' }),
      });
      setApiListings(prev => prev.map(l => 
        l.id === listingId ? { ...l, status: 'ACTIVE' as const } : l
      ));
      toast.success('Listing approved successfully');
    } catch (error) {
      console.error('Failed to approve listing:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle settings save
  const handleSaveSettings = async () => {
    setIsProcessing(true);
    try {
      await api.request('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          platformFee: settings.platformFee,
          minWithdrawal: settings.minWithdrawal,
          featuredListingPrice: settings.featuredListingPrice,
          premiumListingPrice: settings.premiumListingPrice,
          maintenanceMode: settings.maintenanceMode,
          emailNotifications: settings.emailNotifications,
          smsNotifications: settings.smsNotifications,
          autoApproveBusinesses: settings.autoApprove,
          requireIdVerification: settings.requireIdVerification,
        }),
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle user suspend
  const handleSuspendUser = async (userId: string) => {
    setIsProcessing(true);
    try {
      await api.request('/admin/users', {
        method: 'PUT',
        body: JSON.stringify({ userId, action: 'suspend', reason: 'Admin action', adminId: user?.id || 'admin' }),
      });
      setApiUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, status: 'SUSPENDED' } : u
      ));
      toast.success('User suspended successfully');
    } catch (error) {
      console.error('Failed to suspend user:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'pending', label: 'Pending', icon: Clock, count: pendingApps.length },
    { id: 'approved', label: 'Approved', icon: CheckCircle },
    { id: 'rejected', label: 'Rejected', icon: XCircle },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'disputes', label: 'Disputes', icon: AlertTriangle, count: stats.openDisputes },
    { id: 'listings', label: 'Premium Listings', icon: Crown, count: stats.activeListings },
    { id: 'articles', label: 'Articles', icon: Newspaper, count: displayArticles.filter(a => a.status === 'PENDING').length },
    { id: 'advertising', label: 'Advertising', icon: Megaphone, count: displayAds.filter(a => a.status === 'PENDING').length },
    { id: 'reports', label: 'Reports', icon: Flag, count: overviewData?.pending.reports || displayReports.filter(r => r.status === 'PENDING').length },
    { id: 'blocked', label: 'Blocked', icon: Ban, count: displayBans.length },
    { id: 'support', label: 'Support', icon: LifeBuoy, count: overviewData?.pending.tickets || displayTickets.filter(s => s.status === 'OPEN').length },
    { id: 'claims', label: 'Claims', icon: FileWarning, count: overviewData?.pending.claims || displayClaims.filter(c => c.status === 'SUBMITTED' || c.status === 'UNDER_REVIEW').length },
    { id: 'page-content', label: 'Pages', icon: Globe },
    { id: 'revenue', label: 'Revenue', icon: DollarSign },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const getFilteredApps = () => {
    switch (activeTab) {
      case 'pending':
        return filterBySearch(pendingApps);
      case 'approved':
        return filterBySearch(approvedApps);
      case 'rejected':
        return filterBySearch(rejectedApps);
      default:
        return [];
    }
  };

  const handleSettingChange = (key: keyof typeof settings, value: number | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <FadeIn>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div className="flex items-start gap-3">
              <BrandLogo variant="icon" size={40} className="hidden sm:block shrink-0 mt-1" />
              <div>
                <h1 className="text-3xl font-bold">
                  <span className="gradient-text">Admin</span> Dashboard
                </h1>
                <p className="text-muted-foreground">Manage businesses, users, disputes, and platform settings</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium">{user?.name || 'Admin'}</p>
                <p className="text-xs text-muted-foreground">Administrator</p>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Stats Cards */}
        <FadeIn delay={0.1}>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
            <GlassCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalUsers}</p>
                  <p className="text-xs text-muted-foreground">Users</p>
                </div>
              </div>
            </GlassCard>
            <GlassCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalBusinesses}</p>
                  <p className="text-xs text-muted-foreground">Businesses</p>
                </div>
              </div>
            </GlassCard>
            <GlassCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Revenue</p>
                </div>
              </div>
            </GlassCard>
            <GlassCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.openDisputes}</p>
                  <p className="text-xs text-muted-foreground">Disputes</p>
                </div>
              </div>
            </GlassCard>
            <GlassCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                  <Crown className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.activeListings}</p>
                  <p className="text-xs text-muted-foreground">Premium</p>
                </div>
              </div>
            </GlassCard>
          </div>
        </FadeIn>

        {/* Tabs */}
        <FadeIn delay={0.2}>
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                  activeTab === tab.id
                    ? 'gradient-bg text-white shadow-glow-sm'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-xs',
                    activeTab === tab.id ? 'bg-white/20' : 'bg-primary/20 text-primary'
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </FadeIn>

        {/* Content */}
        {activeTab === 'overview' && (
          <FadeIn delay={0.3}>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Revenue Summary */}
              <GlassCard className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Revenue Overview
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Revenue</p>
                      <p className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-green-500 text-sm">
                        <ArrowUpRight className="h-4 w-4" />
                        +18%
                      </div>
                      <p className="text-xs text-muted-foreground">vs last month</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">Commissions</p>
                      <p className="text-lg font-bold">${(overviewData?.overview.totalCommissions || 0).toLocaleString()}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">Listing Revenue</p>
                      <p className="text-lg font-bold">$0</p>
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Recent Activity */}
              <GlassCard className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Recent Applications
                </h3>
                <div className="space-y-3">
                  {pendingApps.length > 0 ? pendingApps.slice(0, 4).map((app: any) => (
                    <div key={app.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{app.name}</p>
                        <p className="text-xs text-muted-foreground">{app.owner?.name}</p>
                      </div>
                      <GlassBadge variant="warning">
                        PENDING
                      </GlassBadge>
                    </div>
                  )) : (
                    <p className="text-center text-muted-foreground py-8">
                      No pending applications
                    </p>
                  )}
                </div>
              </GlassCard>

              {/* Open Disputes */}
              <GlassCard className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-primary" />
                  Open Disputes
                </h3>
                <div className="space-y-3">
                  {displayDisputes.filter(d => d.status !== 'RESOLVED').slice(0, 3).map((dispute) => (
                    <div key={dispute.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <AlertCircle className="h-5 w-5 text-orange-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{dispute.customerName}</p>
                        <p className="text-xs text-muted-foreground truncate">{dispute.type.replace('_', ' ')}</p>
                      </div>
                      <span className="text-sm font-medium">${dispute.amount}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* Quick Actions */}
              <GlassCard className="p-6 lg:col-span-2">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Quick Actions
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => setActiveTab('pending')}
                    className="flex items-center gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors text-left"
                  >
                    <Clock className="h-5 w-5 text-yellow-500" />
                    <div>
                      <p className="font-medium">Review Pending Applications</p>
                      <p className="text-xs text-muted-foreground">{pendingApps.length} awaiting approval</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('disputes')}
                    className="flex items-center gap-3 p-4 rounded-lg bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 transition-colors text-left"
                  >
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="font-medium">Resolve Disputes</p>
                      <p className="text-xs text-muted-foreground">{stats.openDisputes} open disputes</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('listings')}
                    className="flex items-center gap-3 p-4 rounded-lg bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-colors text-left"
                  >
                    <Crown className="h-5 w-5 text-purple-500" />
                    <div>
                      <p className="font-medium">Manage Premium Listings</p>
                      <p className="text-xs text-muted-foreground">{stats.activeListings} active listings</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('revenue')}
                    className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-colors text-left"
                  >
                    <DollarSign className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">View Revenue Reports</p>
                      <p className="text-xs text-muted-foreground">${(overviewData?.monthly.revenue || 0).toLocaleString()} this month</p>
                    </div>
                  </button>
                </div>
              </GlassCard>

              {/* Top Performing Businesses */}
              <GlassCard className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Star className="h-5 w-5 text-primary" />
                  Top Businesses
                </h3>
                <div className="space-y-3">
                  {/* TODO: Fetch top businesses from API when endpoint is available */}
                  {(overviewData?.overview as any)?.topBusinesses?.length ?
                    (overviewData?.overview as any).topBusinesses.map((b: { name: string; bookings: number; revenue: number }, i: number) => (
                      <div key={b.name} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <span className="text-lg font-bold text-primary">#{i + 1}</span>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{b.name}</p>
                          <p className="text-xs text-muted-foreground">{b.bookings} bookings</p>
                        </div>
                        <span className="text-sm font-bold">${b.revenue.toLocaleString()}</span>
                      </div>
                    ))
                  : (
                    <p className="text-center text-muted-foreground py-6 text-sm">No top business data available yet</p>
                  )}
                </div>
              </GlassCard>
            </div>
          </FadeIn>
        )}

        {/* Disputes Tab */}
        {activeTab === 'disputes' && (
          <FadeIn delay={0.3}>
            <div className="space-y-4">
              {displayDisputes.map((dispute) => (
                <GlassCard key={dispute.id} className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                          dispute.status === 'OPEN' ? "bg-orange-500/20" :
                          dispute.status === 'IN_PROGRESS' ? "bg-blue-500/20" : "bg-green-500/20"
                        )}>
                          <AlertTriangle className={cn(
                            "h-6 w-6",
                            dispute.status === 'OPEN' ? "text-orange-500" :
                            dispute.status === 'IN_PROGRESS' ? "text-blue-500" : "text-green-500"
                          )} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{dispute.type.replace('_', ' ')}</h3>
                            <GlassBadge
                              variant={
                                dispute.status === 'OPEN' ? 'warning' :
                                dispute.status === 'IN_PROGRESS' ? 'primary' : 'success'
                              }
                            >
                              {dispute.status}
                            </GlassBadge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{dispute.description}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Customer</p>
                          <p className="font-medium">{dispute.customerName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Provider</p>
                          <p className="font-medium">{dispute.providerName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Amount</p>
                          <p className="font-medium">${dispute.amount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Booking ID</p>
                          <p className="font-medium">{dispute.bookingId}</p>
                        </div>
                      </div>

                      {dispute.status === 'RESOLVED' && dispute.resolution && (
                        <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                          <p className="text-xs font-medium text-green-500">RESOLUTION</p>
                          <p className="text-sm">{dispute.resolution.type} - {dispute.resolution.notes}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex lg:flex-col gap-2 lg:w-40">
                      {dispute.status !== 'RESOLVED' && (
                        <>
                          <GlassButton
                            variant="primary"
                            size="sm"
                            className="flex-1"
                            leftIcon={<MessageSquare className="h-4 w-4" />}
                            onClick={() => {
                              setSelectedDispute(dispute.id);
                              setShowDisputeModal(true);
                            }}
                          >
                            Respond
                          </GlassButton>
                          <GlassButton
                            variant="default"
                            size="sm"
                            className="flex-1"
                            leftIcon={<DollarSign className="h-4 w-4" />}
                            onClick={() => handleRefund(dispute.id, dispute.amount)}
                            disabled={isProcessing}
                          >
                            Refund
                          </GlassButton>
                          <GlassButton
                            variant="default"
                            size="sm"
                            className="flex-1"
                            leftIcon={<Check className="h-4 w-4" />}
                            onClick={() => {
                              setSelectedDispute(dispute.id);
                              setShowResolveModal(true);
                            }}
                          >
                            Resolve
                          </GlassButton>
                        </>
                      )}
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </FadeIn>
        )}

        {/* Premium Listings Tab */}
        {activeTab === 'listings' && (
          <FadeIn delay={0.3}>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayListings.map((listing) => (
                <GlassCard key={listing.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        listing.plan === 'FEATURED' ? "bg-yellow-500/20" : "bg-purple-500/20"
                      )}>
                        <Crown className={cn(
                          "h-6 w-6",
                          listing.plan === 'FEATURED' ? "text-yellow-500" : "text-purple-500"
                        )} />
                      </div>
                      <div>
                        <h3 className="font-semibold">{listing.businessName}</h3>
                        <p className="text-sm text-muted-foreground">{listing.plan}</p>
                      </div>
                    </div>
                    <GlassBadge variant={listing.status === 'ACTIVE' ? 'success' : 'warning'}>
                      {listing.status}
                    </GlassBadge>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Price</span>
                      <span className="font-medium">${listing.price}/month</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Duration</span>
                      <span>{listing.startDate.toLocaleDateString()} - {listing.endDate.toLocaleDateString()}</span>
                    </div>
                    
                    <div className="pt-3 border-t border-border">
                      <p className="text-xs font-medium text-muted-foreground mb-2">PERFORMANCE</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 rounded bg-muted/30">
                          <p className="text-lg font-bold">{listing.impressions.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Views</p>
                        </div>
                        <div className="p-2 rounded bg-muted/30">
                          <p className="text-lg font-bold">{listing.clicks}</p>
                          <p className="text-xs text-muted-foreground">Clicks</p>
                        </div>
                        <div className="p-2 rounded bg-muted/30">
                          <p className="text-lg font-bold">{listing.conversions}</p>
                          <p className="text-xs text-muted-foreground">Bookings</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    {listing.status === 'PENDING' && (
                      <GlassButton
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleApproveListing(listing.id)}
                        disabled={isProcessing}
                      >
                        Approve
                      </GlassButton>
                    )}
                    <GlassButton
                      variant="default"
                      size="sm"
                      className="flex-1"
                      leftIcon={<Eye className="h-4 w-4" />}
                      onClick={() => handleViewListing(listing.id)}
                    >
                      View Details
                    </GlassButton>
                    <GlassButton
                      variant="default"
                      size="sm"
                      className="flex-1"
                      leftIcon={<Settings className="h-4 w-4" />}
                      onClick={() => handleEditListing(listing.id)}
                    >
                      Edit
                    </GlassButton>
                  </div>
                </GlassCard>
              ))}
            </div>
          </FadeIn>
        )}

        {/* Revenue Tab */}
        {activeTab === 'revenue' && (
          <FadeIn delay={0.3}>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <GlassCard className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Revenue</p>
                    <p className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</p>
                  </div>
                </div>
              </GlassCard>
              <GlassCard className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Percent className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Commissions</p>
                    <p className="text-2xl font-bold">${(overviewData?.overview.totalCommissions || 0).toLocaleString()}</p>
                  </div>
                </div>
              </GlassCard>
              <GlassCard className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Crown className="h-6 w-6 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Listing Revenue</p>
                    <p className="text-2xl font-bold">$0</p>
                  </div>
                </div>
              </GlassCard>
              <GlassCard className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center">
                    <Activity className="h-6 w-6 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Transactions</p>
                    <p className="text-2xl font-bold">0</p>
                  </div>
                </div>
              </GlassCard>
            </div>

            {/* Revenue Chart */}
            <GlassCard className="p-6 mb-6">
              <h3 className="font-semibold mb-6 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Revenue Trend (Last 6 Months)
              </h3>
              <div className="flex items-end gap-4 h-48">
                {(overviewData?.revenueChart || []).map((data, i) => (
                  <div key={data.month} className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full gradient-bg rounded-t-lg"
                      style={{ height: `${(data.revenue / 10000) * 100}%` }}
                    />
                    <p className="text-xs text-muted-foreground mt-2">{data.month}</p>
                    <p className="text-xs font-medium">${(data.revenue / 1000).toFixed(1)}k</p>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Revenue Breakdown */}
            <div className="grid md:grid-cols-2 gap-6">
              <GlassCard className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Commission Breakdown
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span>This Month</span>
                    <span className="font-bold">${(overviewData?.monthly.commissions || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span>Last Month</span>
                    <span className="font-bold">$0</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span>Commission Rate</span>
                    <span className="font-bold">{settings.platformFee}%</span>
                  </div>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  Listing Revenue
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span>Featured Listings</span>
                    <span className="font-bold">$198</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span>Premium Listings</span>
                    <span className="font-bold">$49</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span>Active Listings</span>
                    <span className="font-bold">{stats.activeListings}</span>
                  </div>
                </div>
              </GlassCard>
            </div>
          </FadeIn>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <FadeIn delay={0.3}>
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  User Management
                </h3>
                <GlassInput
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="h-4 w-4" />}
                  className="w-64"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium">User</th>
                      <th className="text-left py-3 px-4 text-sm font-medium">Email</th>
                      <th className="text-left py-3 px-4 text-sm font-medium">Role</th>
                      <th className="text-left py-3 px-4 text-sm font-medium">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium">Joined</th>
                      <th className="text-left py-3 px-4 text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayUsers.filter(u => 
                      !searchQuery || 
                      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      u.email.toLowerCase().includes(searchQuery.toLowerCase())
                    ).map((u) => (
                      <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                              <span className="text-sm font-medium">{u.name.charAt(0)}</span>
                            </div>
                            <span className="font-medium">{u.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{u.email}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {u.roles && u.roles.length > 1 ? (
                              u.roles.map((r, idx) => (
                                <GlassBadge key={idx} variant={r === 'BUSINESS_OWNER' ? 'primary' : 'default'} className="text-xs">
                                  {r === 'BUSINESS_OWNER' ? 'Provider' : 'Customer'}
                                </GlassBadge>
                              ))
                            ) : (
                              <GlassBadge variant={u.role === 'BUSINESS_OWNER' ? 'primary' : 'default'}>
                                {u.role === 'BUSINESS_OWNER' ? 'Provider' : 'Customer'}
                              </GlassBadge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <GlassBadge variant={u.status === 'ACTIVE' ? 'success' : 'destructive'}>
                            {u.status}
                          </GlassBadge>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {u.joinedAt.toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <GlassButton
                              variant="default"
                              size="sm"
                              leftIcon={<Eye className="h-4 w-4" />}
                              onClick={() => handleViewUser(u.id)}
                            >
                              View
                            </GlassButton>
                            {u.status === 'ACTIVE' ? (
                              <GlassButton
                                variant="default"
                                size="sm"
                                leftIcon={<Ban className="h-4 w-4" />}
                                onClick={() => handleToggleUserStatus(u.id)}
                                disabled={isProcessing}
                                className="text-destructive hover:bg-destructive/10"
                              >
                                Suspend
                              </GlassButton>
                            ) : (
                              <GlassButton
                                variant="default"
                                size="sm"
                                leftIcon={<UserCheck className="h-4 w-4" />}
                                onClick={() => handleToggleUserStatus(u.id)}
                                disabled={isProcessing}
                                className="text-green-500 hover:bg-green-500/10"
                              >
                                Activate
                              </GlassButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </FadeIn>
        )}

        {/* Applications Tabs (pending, approved, rejected) */}
        {['pending', 'approved', 'rejected'].includes(activeTab) && (
          <>
            <FadeIn delay={0.3}>
              <div className="mb-6">
                <GlassInput
                  placeholder="Search by business name, owner name, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="h-4 w-4" />}
                  className="w-full"
                />
              </div>
            </FadeIn>

            <FadeIn delay={0.4}>
              <div className="space-y-4">
                {getFilteredApps().length > 0 ? (
                  getFilteredApps().map((app: any) => (
                    <GlassCard key={app.id} className="p-4 sm:p-6">
                      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                              <Building2 className="h-6 w-6 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-semibold text-lg">{app.name}</h3>
                              <p className="text-sm text-muted-foreground">{app.description}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span>{app.owner?.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span className="truncate">{app.owner?.email}</span>
                            </div>
                            {app.owner?.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span>{app.owner.phone}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span>{app.city}{app.city && app.country ? ', ' : ''}{app.country}</span>
                            </div>
                          </div>

                          <div className="mt-4 p-3 rounded-lg bg-muted/50">
                            <p className="text-xs font-medium text-muted-foreground mb-1">BUSINESS DETAILS</p>
                            <div className="flex items-center gap-4 text-sm">
                              <div>
                                <span className="text-xs text-muted-foreground">Category:</span>
                                <span className="ml-1 font-medium">{app.category || 'General Grooming'}</span>
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground">Services:</span>
                                <span className="ml-1 font-medium">{app._count?.services || 0}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex lg:flex-col gap-2 lg:w-40">
                          {app.verificationStatus === 'PENDING' && (
                            <>
                              <GlassButton
                                variant="primary"
                                size="sm"
                                className="flex-1"
                                onClick={() => handleApprove(app.id)}
                                isLoading={isProcessing}
                                leftIcon={<Check className="h-4 w-4" />}
                              >
                                Approve
                              </GlassButton>
                              <GlassButton
                                variant="default"
                                size="sm"
                                className="flex-1"
                                onClick={() => {
                                  setSelectedApplication(app.id);
                                  setShowRejectModal(true);
                                }}
                                leftIcon={<X className="h-4 w-4" />}
                              >
                                Reject
                              </GlassButton>
                            </>
                          )}
                          {app.verificationStatus === 'APPROVED' && (
                            <GlassBadge variant="success" className="justify-center py-2">
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approved
                            </GlassBadge>
                          )}
                          {app.verificationStatus === 'REJECTED' && (
                            <div className="space-y-2 w-full">
                              <GlassBadge variant="destructive" className="justify-center py-2 w-full">
                                <XCircle className="h-4 w-4 mr-2" />
                                Rejected
                              </GlassBadge>
                              {app.rejectionReason && (
                                <p className="text-xs text-muted-foreground text-center">
                                  Reason: {app.rejectionReason}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </GlassCard>
                  ))
                ) : (
                  <GlassCard className="p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                      {activeTab === 'pending' ? (
                        <Clock className="h-8 w-8 text-muted-foreground" />
                      ) : activeTab === 'approved' ? (
                        <CheckCircle className="h-8 w-8 text-muted-foreground" />
                      ) : (
                        <XCircle className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <h3 className="font-semibold mb-2">
                      No {activeTab} applications
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {searchQuery
                        ? 'Try adjusting your search query'
                        : `There are no ${activeTab} applications at the moment`}
                    </p>
                  </GlassCard>
                )}
              </div>
            </FadeIn>
          </>
        )}

        {/* Articles Tab */}
        {activeTab === 'articles' && (
          <FadeIn delay={0.3}>
            <div className="space-y-4">
              {/* Articles Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold">Blog Articles</h2>
                  <p className="text-sm text-muted-foreground">Manage and publish blog articles</p>
                </div>
                <GlassButton
                  variant="primary"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={() => {
                    // TODO: Open create article modal
                    alert('Create article functionality coming soon!');
                  }}
                >
                  New Article
                </GlassButton>
              </div>

              {/* Article Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <GlassCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{displayArticles.filter(a => a.status === 'PENDING').length}</p>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{displayArticles.filter(a => a.status === 'PUBLISHED').length}</p>
                      <p className="text-xs text-muted-foreground">Published</p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-500/20 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{displayArticles.filter(a => a.status === 'DRAFT').length}</p>
                      <p className="text-xs text-muted-foreground">Drafts</p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                      <XCircle className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{displayArticles.filter(a => a.status === 'REJECTED').length}</p>
                      <p className="text-xs text-muted-foreground">Rejected</p>
                    </div>
                  </div>
                </GlassCard>
              </div>

              {/* Articles List */}
              {displayArticles.map((article) => (
                <GlassCard key={article.id} className="p-4 sm:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                          <Newspaper className="h-6 w-6 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-lg">{article.title}</h3>
                            <GlassBadge
                              variant={
                                article.status === 'PUBLISHED' ? 'success' :
                                article.status === 'PENDING' ? 'warning' :
                                article.status === 'DRAFT' ? 'default' : 'destructive'
                              }
                            >
                              {article.status}
                            </GlassBadge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{article.excerpt}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{article.author}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-muted-foreground" />
                          <span>{article.category}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                          <span>{article.views.toLocaleString()} views</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Heart className="h-4 w-4 text-muted-foreground" />
                          <span>{article.likes} likes</span>
                        </div>
                      </div>

                      {article.adminNotes && (
                        <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                          <p className="text-xs font-medium text-red-500">ADMIN NOTES</p>
                          <p className="text-sm">{article.adminNotes}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex lg:flex-col gap-2 lg:w-48">
                      {article.status === 'PENDING' && (
                        <>
                          <GlassButton
                            variant="primary"
                            size="sm"
                            className="flex-1"
                            leftIcon={<Check className="h-4 w-4" />}
                            onClick={() => {
                              // TODO: Implement publish article
                              alert(`Article "${article.title}" published!`);
                            }}
                          >
                            Publish
                          </GlassButton>
                          <GlassButton
                            variant="outline"
                            size="sm"
                            className="flex-1 text-red-500 border-red-500 hover:bg-red-500/10"
                            leftIcon={<X className="h-4 w-4" />}
                            onClick={() => {
                              // TODO: Implement reject article
                              alert(`Article "${article.title}" rejected!`);
                            }}
                          >
                            Reject
                          </GlassButton>
                        </>
                      )}
                      {article.status === 'PUBLISHED' && (
                        <GlassButton
                          variant="default"
                          size="sm"
                          className="flex-1"
                          leftIcon={<Eye className="h-4 w-4" />}
                        >
                          View Live
                        </GlassButton>
                      )}
                      {article.status === 'DRAFT' && (
                        <GlassButton
                          variant="default"
                          size="sm"
                          className="flex-1"
                          leftIcon={<Edit className="h-4 w-4" />}
                        >
                          Edit Draft
                        </GlassButton>
                      )}
                      <GlassButton
                        variant="default"
                        size="sm"
                        className="flex-1"
                        leftIcon={<Edit className="h-4 w-4" />}
                        onClick={() => {
                          // TODO: Open edit modal
                          alert(`Edit article: ${article.title}`);
                        }}
                      >
                        Edit
                      </GlassButton>
                      <GlassButton
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-red-500 hover:bg-red-500/10"
                        leftIcon={<Trash2 className="h-4 w-4" />}
                        onClick={() => {
                          if (confirm(`Delete article "${article.title}"?`)) {
                            alert('Article deleted!');
                          }
                        }}
                      >
                        Delete
                      </GlassButton>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </FadeIn>
        )}

        {/* Claims Management Tab */}
        {activeTab === 'claims' && (
          <FadeIn delay={0.3}>
            <div className="space-y-4">
              {/* Claims Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <GlassCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <FileWarning className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{displayClaims.filter(c => c.status === 'SUBMITTED').length}</p>
                      <p className="text-xs text-muted-foreground">Submitted</p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{displayClaims.filter(c => c.status === 'UNDER_REVIEW').length}</p>
                      <p className="text-xs text-muted-foreground">Under Review</p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{displayClaims.filter(c => c.status === 'APPROVED').length}</p>
                      <p className="text-xs text-muted-foreground">Approved</p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                      <XCircle className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{displayClaims.filter(c => c.status === 'REJECTED').length}</p>
                      <p className="text-xs text-muted-foreground">Rejected</p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">${displayClaims.filter(c => c.status === 'APPROVED' || c.status === 'PAID').reduce((acc, c) => acc + c.amount, 0)}</p>
                      <p className="text-xs text-muted-foreground">Total Paid</p>
                    </div>
                  </div>
                </GlassCard>
              </div>

              {/* Claims List */}
              {displayClaims.map((claim) => (
                <GlassCard key={claim.id} className="p-4 sm:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                          claim.status === 'SUBMITTED' ? "bg-blue-500/20" :
                          claim.status === 'UNDER_REVIEW' ? "bg-yellow-500/20" :
                          claim.status === 'APPROVED' || claim.status === 'PAID' ? "bg-green-500/20" : "bg-red-500/20"
                        )}>
                          <FileWarning className={cn(
                            "h-6 w-6",
                            claim.status === 'SUBMITTED' ? "text-blue-500" :
                            claim.status === 'UNDER_REVIEW' ? "text-yellow-500" :
                            claim.status === 'APPROVED' || claim.status === 'PAID' ? "text-green-500" : "text-red-500"
                          )} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-lg">{claim.claimNumber}</h3>
                            <GlassBadge
                              variant={
                                claim.status === 'SUBMITTED' ? 'primary' :
                                claim.status === 'UNDER_REVIEW' ? 'warning' :
                                claim.status === 'APPROVED' || claim.status === 'PAID' ? 'success' : 'destructive'
                              }
                            >
                              {claim.status.replace('_', ' ')}
                            </GlassBadge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{claim.type.replace('_', ' ')} - {claim.description}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{claim.customerName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>{claim.providerName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span>${claim.amount}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{claim.incidentDate.toLocaleDateString()}</span>
                        </div>
                      </div>

                      {claim.documents && claim.documents.length > 0 && (
                        <div className="mt-4 p-3 rounded-lg bg-muted/50">
                          <p className="text-xs font-medium text-muted-foreground mb-2">ATTACHMENTS</p>
                          <div className="flex flex-wrap gap-2">
                            {claim.documents.map((doc, i) => (
                              <button key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background/50 border border-border text-sm hover:bg-background/80 transition-colors">
                                <FileText className="h-4 w-4" />
                                {doc}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {claim.adminNotes && (
                        <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <p className="text-xs font-medium text-blue-500">ADMIN NOTES</p>
                          <p className="text-sm mt-1">{claim.adminNotes}</p>
                        </div>
                      )}

                      {claim.resolution && (
                        <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                          <p className="text-xs font-medium text-green-500">RESOLUTION</p>
                          <p className="text-sm mt-1">{claim.resolution}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex lg:flex-col gap-2 lg:w-32">
                      {(claim.status === 'SUBMITTED' || claim.status === 'UNDER_REVIEW') && (
                        <>
                          <GlassButton
                            variant="primary"
                            size="sm"
                            className="flex-1"
                            leftIcon={<Check className="h-4 w-4" />}
                            onClick={() => alert(`Claim ${claim.claimNumber} approved!`)}
                          >
                            Approve
                          </GlassButton>
                          <GlassButton
                            variant="outline"
                            size="sm"
                            className="flex-1 text-red-500 border-red-500 hover:bg-red-500/10"
                            leftIcon={<X className="h-4 w-4" />}
                            onClick={() => alert(`Claim ${claim.claimNumber} rejected!`)}
                          >
                            Reject
                          </GlassButton>
                        </>
                      )}
                      <GlassButton
                        variant="default"
                        size="sm"
                        className="flex-1"
                        leftIcon={<Eye className="h-4 w-4" />}
                      >
                        Details
                      </GlassButton>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </FadeIn>
        )}

        {/* Reports Management Tab */}
        {activeTab === 'reports' && (
          <FadeIn delay={0.3}>
            <div className="space-y-4">
              {/* Reports Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <GlassCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                      <Flag className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{displayReports.filter(r => r.status === 'PENDING').length}</p>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Search className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{displayReports.filter(r => r.status === 'INVESTIGATING').length}</p>
                      <p className="text-xs text-muted-foreground">Investigating</p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{displayReports.filter(r => r.status === 'RESOLVED').length}</p>
                      <p className="text-xs text-muted-foreground">Resolved</p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-500/20 flex items-center justify-center">
                      <XCircle className="h-5 w-5 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{displayReports.filter(r => r.status === 'DISMISSED').length}</p>
                      <p className="text-xs text-muted-foreground">Dismissed</p>
                    </div>
                  </div>
                </GlassCard>
              </div>

              {/* Reports List */}
              {displayReports.map((report) => (
                <GlassCard key={report.id} className="p-4 sm:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                          report.status === 'PENDING' ? "bg-red-500/20" :
                          report.status === 'INVESTIGATING' ? "bg-blue-500/20" :
                          report.status === 'RESOLVED' ? "bg-green-500/20" : "bg-slate-500/20"
                        )}>
                          <Flag className={cn(
                            "h-6 w-6",
                            report.status === 'PENDING' ? "text-red-500" :
                            report.status === 'INVESTIGATING' ? "text-blue-500" :
                            report.status === 'RESOLVED' ? "text-green-500" : "text-slate-500"
                          )} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-lg">{report.reason}</h3>
                            <GlassBadge variant="secondary">{report.type}</GlassBadge>
                            <GlassBadge
                              variant={
                                report.status === 'PENDING' ? 'destructive' :
                                report.status === 'INVESTIGATING' ? 'primary' :
                                report.status === 'RESOLVED' ? 'success' : 'default'
                              }
                            >
                              {report.status}
                            </GlassBadge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{report.description}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-4 p-4 rounded-lg bg-muted/50">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">REPORTER</p>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{report.reporterName}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{report.reporterEmail}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">REPORTED USER</p>
                          <div className="flex items-center gap-2">
                            <UserX className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{report.reportedUserName}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{report.reportedUserEmail}</p>
                        </div>
                      </div>

                      {report.adminNotes && (
                        <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <p className="text-xs font-medium text-blue-500">ADMIN NOTES</p>
                          <p className="text-sm mt-1">{report.adminNotes}</p>
                        </div>
                      )}

                      {report.action && (
                        <div className="mt-4 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                          <p className="text-xs font-medium text-orange-500">ACTION TAKEN</p>
                          <p className="text-sm mt-1">{report.action.replace('_', ' ')}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex lg:flex-col gap-2 lg:w-40">
                      {report.status === 'PENDING' && (
                        <>
                          <GlassButton
                            variant="primary"
                            size="sm"
                            className="flex-1"
                            leftIcon={<Search className="h-4 w-4" />}
                            onClick={() => alert(`Investigating report ${report.id}`)}
                          >
                            Investigate
                          </GlassButton>
                          <GlassButton
                            variant="outline"
                            size="sm"
                            className="flex-1 text-red-500 border-red-500 hover:bg-red-500/10"
                            leftIcon={<Ban className="h-4 w-4" />}
                            onClick={() => alert(`Ban user for report ${report.id}`)}
                          >
                            Ban User
                          </GlassButton>
                        </>
                      )}
                      {report.status === 'INVESTIGATING' && (
                        <>
                          <GlassButton
                            variant="primary"
                            size="sm"
                            className="flex-1"
                            leftIcon={<Check className="h-4 w-4" />}
                            onClick={() => alert(`Resolve report ${report.id}`)}
                          >
                            Resolve
                          </GlassButton>
                          <GlassButton
                            variant="default"
                            size="sm"
                            className="flex-1"
                            leftIcon={<X className="h-4 w-4" />}
                            onClick={() => alert(`Dismiss report ${report.id}`)}
                          >
                            Dismiss
                          </GlassButton>
                        </>
                      )}
                      {report.status === 'RESOLVED' && (
                        <GlassBadge variant="success" className="justify-center py-2">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Resolved
                        </GlassBadge>
                      )}
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </FadeIn>
        )}

        {/* Blocked Users Tab */}
        {activeTab === 'blocked' && (
          <FadeIn delay={0.3}>
            <div className="space-y-4">
              {/* Blocked Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <GlassCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                      <Ban className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{displayBans.length}</p>
                      <p className="text-xs text-muted-foreground">Total Blocked</p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{displayBans.filter(b => b.appealStatus === 'PENDING').length}</p>
                      <p className="text-xs text-muted-foreground">Pending Appeals</p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <Unlock className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{displayBans.filter(b => b.unblockScheduledAt).length}</p>
                      <p className="text-xs text-muted-foreground">Scheduled Unblocks</p>
                    </div>
                  </div>
                </GlassCard>
              </div>

              {/* Blocked Users List */}
              {displayBans.map((blocked) => (
                <GlassCard key={blocked.id} className="p-4 sm:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                          <UserX className="h-6 w-6 text-red-500" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-lg">{blocked.userName}</h3>
                            <GlassBadge
                              variant={blocked.appealStatus === 'PENDING' ? 'warning' : blocked.appealStatus === 'REJECTED' ? 'destructive' : 'default'}
                            >
                              {blocked.appealStatus === 'PENDING' ? 'Appeal Pending' : 
                               blocked.appealStatus === 'REJECTED' ? 'Appeal Rejected' :
                               blocked.appealStatus === 'APPROVED' ? 'Appeal Approved' : 'No Appeal'}
                            </GlassBadge>
                          </div>
                          <p className="text-sm text-muted-foreground">{blocked.userEmail}</p>
                        </div>
                      </div>

                      <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                        <p className="text-xs font-medium text-red-500 mb-2">REASON FOR BLOCKING</p>
                        <p className="text-sm">{blocked.reason}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>Blocked: {blocked.blockedAt.toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          <span>By: {blocked.blockedBy}</span>
                        </div>
                      </div>

                      {blocked.appealReason && (
                        <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                          <p className="text-xs font-medium text-yellow-500">APPEAL REASON</p>
                          <p className="text-sm mt-1">{blocked.appealReason}</p>
                          {blocked.appealDate && (
                            <p className="text-xs text-muted-foreground mt-2">Submitted: {blocked.appealDate.toLocaleDateString()}</p>
                          )}
                        </div>
                      )}

                      {blocked.unblockScheduledAt && (
                        <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                          <p className="text-xs font-medium text-green-500">SCHEDULED UNBLOCK</p>
                          <p className="text-sm mt-1">{blocked.unblockScheduledAt.toLocaleDateString()}</p>
                        </div>
                      )}

                      {blocked.adminNotes && (
                        <div className="mt-4 p-3 rounded-lg bg-muted/50">
                          <p className="text-xs font-medium text-muted-foreground">ADMIN NOTES</p>
                          <p className="text-sm mt-1">{blocked.adminNotes}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex lg:flex-col gap-2 lg:w-40">
                      {blocked.appealStatus === 'PENDING' && (
                        <>
                          <GlassButton
                            variant="primary"
                            size="sm"
                            className="flex-1"
                            leftIcon={<Check className="h-4 w-4" />}
                            onClick={() => alert(`Appeal approved for ${blocked.userName}`)}
                          >
                            Approve Appeal
                          </GlassButton>
                          <GlassButton
                            variant="outline"
                            size="sm"
                            className="flex-1 text-red-500 border-red-500 hover:bg-red-500/10"
                            leftIcon={<X className="h-4 w-4" />}
                            onClick={() => alert(`Appeal rejected for ${blocked.userName}`)}
                          >
                            Reject Appeal
                          </GlassButton>
                        </>
                      )}
                      <GlassButton
                        variant="default"
                        size="sm"
                        className="flex-1"
                        leftIcon={<Unlock className="h-4 w-4" />}
                        onClick={() => alert(`Unblock ${blocked.userName}`)}
                      >
                        Remove Block
                      </GlassButton>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </FadeIn>
        )}

        {/* Advertising Submissions Tab */}
        {activeTab === 'advertising' && (
          <FadeIn delay={0.3}>
            <div className="space-y-4">
              {/* Advertising Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <GlassCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{displayAds.filter(a => a.status === 'PENDING').length}</p>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <Zap className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{displayAds.filter(a => a.status === 'ACTIVE').length}</p>
                      <p className="text-xs text-muted-foreground">Active</p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{displayAds.filter(a => a.status === 'COMPLETED').length}</p>
                      <p className="text-xs text-muted-foreground">Completed</p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">${displayAds.reduce((acc, a) => acc + a.budget, 0).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Total Budget</p>
                    </div>
                  </div>
                </GlassCard>
              </div>

              {/* Ad Requests List */}
              {displayAds.map((ad) => (
                <GlassCard key={ad.id} className="p-4 sm:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                          ad.status === 'PENDING' ? "bg-yellow-500/20" :
                          ad.status === 'ACTIVE' ? "bg-green-500/20" :
                          ad.status === 'COMPLETED' ? "bg-blue-500/20" : "bg-red-500/20"
                        )}>
                          <Megaphone className={cn(
                            "h-6 w-6",
                            ad.status === 'PENDING' ? "text-yellow-500" :
                            ad.status === 'ACTIVE' ? "text-green-500" :
                            ad.status === 'COMPLETED' ? "text-blue-500" : "text-red-500"
                          )} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-lg">{ad.businessName}</h3>
                            <GlassBadge variant="secondary">{ad.package}</GlassBadge>
                            <GlassBadge
                              variant={
                                ad.status === 'PENDING' ? 'warning' :
                                ad.status === 'ACTIVE' ? 'success' :
                                ad.status === 'COMPLETED' ? 'primary' : 'destructive'
                              }
                            >
                              {ad.status}
                            </GlassBadge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{ad.notes}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate">{ad.contactEmail}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{ad.contactPhone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span>${ad.budget} budget</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{ad.duration} days</span>
                        </div>
                      </div>

                      {ad.status === 'ACTIVE' && (
                        <div className="mt-4 p-4 rounded-lg bg-muted/50">
                          <p className="text-xs font-medium text-muted-foreground mb-3">PERFORMANCE</p>
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                              <p className="text-lg font-bold">{ad.impressions.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">Impressions</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold">{ad.clicks}</p>
                              <p className="text-xs text-muted-foreground">Clicks</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold">{ad.conversions}</p>
                              <p className="text-xs text-muted-foreground">Conversions</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex lg:flex-col gap-2 lg:w-40">
                      {ad.status === 'PENDING' && (
                        <>
                          <GlassButton
                            variant="primary"
                            size="sm"
                            className="flex-1"
                            leftIcon={<Check className="h-4 w-4" />}
                            onClick={() => alert(`Approved ad for ${ad.businessName}`)}
                          >
                            Approve
                          </GlassButton>
                          <GlassButton
                            variant="default"
                            size="sm"
                            className="flex-1"
                            leftIcon={<Mail className="h-4 w-4" />}
                            onClick={() => alert(`Contact ${ad.businessName}`)}
                          >
                            Contact
                          </GlassButton>
                        </>
                      )}
                      {ad.status === 'ACTIVE' && (
                        <GlassButton
                          variant="default"
                          size="sm"
                          className="flex-1"
                          leftIcon={<Eye className="h-4 w-4" />}
                        >
                          View Stats
                        </GlassButton>
                      )}
                      {ad.status === 'COMPLETED' && (
                        <GlassButton
                          variant="default"
                          size="sm"
                          className="flex-1"
                          leftIcon={<RefreshCw className="h-4 w-4" />}
                          onClick={() => alert(`Renew ad for ${ad.businessName}`)}
                        >
                          Renew
                        </GlassButton>
                      )}
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </FadeIn>
        )}

        {/* Support Messages Tab */}
        {activeTab === 'support' && (
          <FadeIn delay={0.3}>
            <div className="space-y-4">
              {/* Support Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <GlassCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                      <Inbox className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{displayTickets.filter(s => s.status === 'OPEN').length}</p>
                      <p className="text-xs text-muted-foreground">Open</p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{displayTickets.filter(s => s.status === 'IN_PROGRESS').length}</p>
                      <p className="text-xs text-muted-foreground">In Progress</p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{displayTickets.filter(s => s.status === 'WAITING').length}</p>
                      <p className="text-xs text-muted-foreground">Waiting</p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{displayTickets.filter(s => s.status === 'RESOLVED').length}</p>
                      <p className="text-xs text-muted-foreground">Resolved</p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{displayTickets.filter(s => s.priority === 'URGENT').length}</p>
                      <p className="text-xs text-muted-foreground">Urgent</p>
                    </div>
                  </div>
                </GlassCard>
              </div>

              {/* Support Messages List */}
              {displayTickets.map((msg) => (
                <GlassCard key={msg.id} className="p-4 sm:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                          msg.priority === 'URGENT' ? "bg-red-500/20" :
                          msg.priority === 'HIGH' ? "bg-orange-500/20" :
                          msg.priority === 'MEDIUM' ? "bg-yellow-500/20" : "bg-green-500/20"
                        )}>
                          <LifeBuoy className={cn(
                            "h-6 w-6",
                            msg.priority === 'URGENT' ? "text-red-500" :
                            msg.priority === 'HIGH' ? "text-orange-500" :
                            msg.priority === 'MEDIUM' ? "text-yellow-500" : "text-green-500"
                          )} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-lg">{msg.subject}</h3>
                            <GlassBadge variant="secondary">{msg.category}</GlassBadge>
                            <GlassBadge
                              variant={
                                msg.priority === 'URGENT' ? 'destructive' :
                                msg.priority === 'HIGH' ? 'warning' : 'default'
                              }
                            >
                              {msg.priority}
                            </GlassBadge>
                            <GlassBadge
                              variant={
                                msg.status === 'OPEN' ? 'destructive' :
                                msg.status === 'IN_PROGRESS' ? 'primary' :
                                msg.status === 'WAITING' ? 'warning' : 'success'
                              }
                            >
                              {msg.status.replace('_', ' ')}
                            </GlassBadge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{msg.message}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-4 p-4 rounded-lg bg-muted/50">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">FROM</p>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{msg.userName}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{msg.userEmail}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">TIMELINE</p>
                          <p className="text-sm">Created: {msg.createdAt.toLocaleDateString()}</p>
                          <p className="text-xs text-muted-foreground">Updated: {msg.updatedAt.toLocaleDateString()}</p>
                        </div>
                      </div>

                      {msg.replies.length > 0 && (
                        <div className="mt-4 space-y-3">
                          <p className="text-xs font-medium text-muted-foreground">REPLIES ({msg.replies.length})</p>
                          {msg.replies.map((reply) => (
                            <div key={reply.id} className={cn(
                              "p-3 rounded-lg",
                              reply.from === 'ADMIN' ? "bg-primary/10 border border-primary/20" : "bg-muted/50"
                            )}>
                              <div className="flex items-center gap-2 mb-2">
                                <GlassBadge variant={reply.from === 'ADMIN' ? 'primary' : 'default'} className="text-xs">
                                  {reply.from}
                                </GlassBadge>
                                {reply.adminName && <span className="text-xs text-muted-foreground">{reply.adminName}</span>}
                                <span className="text-xs text-muted-foreground ml-auto">{reply.createdAt.toLocaleDateString()}</span>
                              </div>
                              <p className="text-sm">{reply.message}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex lg:flex-col gap-2 lg:w-40">
                      {msg.status !== 'RESOLVED' && msg.status !== 'CLOSED' && (
                        <>
                          <GlassButton
                            variant="primary"
                            size="sm"
                            className="flex-1"
                            leftIcon={<Send className="h-4 w-4" />}
                            onClick={() => alert(`Reply to ticket from ${msg.userName}`)}
                          >
                            Reply
                          </GlassButton>
                          <GlassButton
                            variant="default"
                            size="sm"
                            className="flex-1"
                            leftIcon={<Check className="h-4 w-4" />}
                            onClick={() => alert(`Resolve ticket from ${msg.userName}`)}
                          >
                            Resolve
                          </GlassButton>
                        </>
                      )}
                      {msg.status === 'RESOLVED' && (
                        <GlassBadge variant="success" className="justify-center py-2">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Resolved
                        </GlassBadge>
                      )}
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </FadeIn>
        )}

        {/* Page Content Management Tab */}
        {activeTab === 'page-content' && (
          <FadeIn delay={0.3}>
            <div className="grid md:grid-cols-2 gap-6">
              {displayPageContent.map((page) => (
                <GlassCard key={page.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        page.page === 'about' ? "bg-blue-500/20" :
                        page.page === 'privacy' ? "bg-green-500/20" :
                        page.page === 'terms' ? "bg-purple-500/20" : "bg-orange-500/20"
                      )}>
                        <Globe className={cn(
                          "h-6 w-6",
                          page.page === 'about' ? "text-blue-500" :
                          page.page === 'privacy' ? "text-green-500" :
                          page.page === 'terms' ? "text-purple-500" : "text-orange-500"
                        )} />
                      </div>
                      <div>
                        <h3 className="font-semibold">{page.title}</h3>
                        <p className="text-sm text-muted-foreground capitalize">{page.page} Page</p>
                      </div>
                    </div>
                    <GlassBadge variant="secondary">
                      {page.page}
                    </GlassBadge>
                  </div>

                  <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                    {page.content}
                  </p>

                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                    <span>Last updated: {page.lastUpdated.toLocaleDateString()}</span>
                    <span>By: {page.updatedBy}</span>
                  </div>

                  <div className="flex gap-2">
                    <GlassButton
                      variant="default"
                      size="sm"
                      className="flex-1"
                      leftIcon={<Edit className="h-4 w-4" />}
                      onClick={() => alert(`Edit ${page.page} page`)}
                    >
                      Edit Content
                    </GlassButton>
                    <GlassButton
                      variant="default"
                      size="sm"
                      className="flex-1"
                      leftIcon={<Eye className="h-4 w-4" />}
                      onClick={() => alert(`Preview ${page.page} page`)}
                    >
                      Preview
                    </GlassButton>
                  </div>
                </GlassCard>
              ))}
            </div>

            {/* Quick Actions */}
            <GlassCard className="p-6 mt-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Quick Actions
              </h3>
              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
                <GlassButton
                  variant="default"
                  className="justify-start"
                  leftIcon={<FileText className="h-4 w-4" />}
                  onClick={() => alert('Create new page')}
                >
                  Create New Page
                </GlassButton>
                <GlassButton
                  variant="default"
                  className="justify-start"
                  leftIcon={<Download className="h-4 w-4" />}
                  onClick={() => alert('Export all pages')}
                >
                  Export All Pages
                </GlassButton>
                <GlassButton
                  variant="default"
                  className="justify-start"
                  leftIcon={<Globe className="h-4 w-4" />}
                  onClick={() => alert('View live site')}
                >
                  View Live Site
                </GlassButton>
                <GlassButton
                  variant="default"
                  className="justify-start"
                  leftIcon={<RefreshCw className="h-4 w-4" />}
                  onClick={() => alert('Clear page cache')}
                >
                  Clear Cache
                </GlassButton>
              </div>
            </GlassCard>
          </FadeIn>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <FadeIn delay={0.3}>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Platform Fees */}
              <GlassCard className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Percent className="h-5 w-5 text-primary" />
                  Platform Fees & Pricing
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Service Fee (%)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={settings.platformFee}
                        onChange={(e) => handleSettingChange('platformFee', parseInt(e.target.value))}
                        className="flex-1 h-10 px-3 rounded-lg border border-input bg-background/50"
                        min="0"
                        max="50"
                      />
                      <span className="text-muted-foreground">%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Fee charged on each booking</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Minimum Withdrawal ($)</label>
                    <input
                      type="number"
                      value={settings.minWithdrawal}
                      onChange={(e) => handleSettingChange('minWithdrawal', parseInt(e.target.value))}
                      className="w-full h-10 px-3 rounded-lg border border-input bg-background/50"
                      min="10"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Minimum amount for business payouts</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Featured Listing Price ($)</label>
                    <input
                      type="number"
                      value={settings.featuredListingPrice}
                      onChange={(e) => handleSettingChange('featuredListingPrice', parseInt(e.target.value))}
                      className="w-full h-10 px-3 rounded-lg border border-input bg-background/50"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Premium Listing Price ($)</label>
                    <input
                      type="number"
                      value={settings.premiumListingPrice}
                      onChange={(e) => handleSettingChange('premiumListingPrice', parseInt(e.target.value))}
                      className="w-full h-10 px-3 rounded-lg border border-input bg-background/50"
                      min="0"
                    />
                  </div>
                </div>
              </GlassCard>

              {/* Notifications */}
              <GlassCard className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  Notifications
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-xs text-muted-foreground">Send email alerts for new applications</p>
                    </div>
                    <button
                      onClick={() => handleSettingChange('emailNotifications', !settings.emailNotifications)}
                      className="text-primary"
                    >
                      {settings.emailNotifications ? (
                        <ToggleRight className="h-8 w-8" />
                      ) : (
                        <ToggleLeft className="h-8 w-8 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">SMS Notifications</p>
                      <p className="text-xs text-muted-foreground">Send SMS for urgent matters</p>
                    </div>
                    <button
                      onClick={() => handleSettingChange('smsNotifications', !settings.smsNotifications)}
                    >
                      {settings.smsNotifications ? (
                        <ToggleRight className="h-8 w-8 text-primary" />
                      ) : (
                        <ToggleLeft className="h-8 w-8 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>
              </GlassCard>

              {/* Security */}
              <GlassCard className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  Security & Verification
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">Require ID Verification</p>
                      <p className="text-xs text-muted-foreground">Businesses must upload ID document</p>
                    </div>
                    <button
                      onClick={() => handleSettingChange('requireIdVerification', !settings.requireIdVerification)}
                    >
                      {settings.requireIdVerification ? (
                        <ToggleRight className="h-8 w-8 text-primary" />
                      ) : (
                        <ToggleLeft className="h-8 w-8 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">Auto-Approve Businesses</p>
                      <p className="text-xs text-muted-foreground">Skip manual review process</p>
                    </div>
                    <button
                      onClick={() => handleSettingChange('autoApprove', !settings.autoApprove)}
                    >
                      {settings.autoApprove ? (
                        <ToggleRight className="h-8 w-8 text-primary" />
                      ) : (
                        <ToggleLeft className="h-8 w-8 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>
              </GlassCard>

              {/* Maintenance */}
              <GlassCard className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-primary" />
                  Maintenance
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div>
                      <p className="font-medium">Maintenance Mode</p>
                      <p className="text-xs text-muted-foreground">Temporarily disable the platform</p>
                    </div>
                    <button
                      onClick={() => handleSettingChange('maintenanceMode', !settings.maintenanceMode)}
                    >
                      {settings.maintenanceMode ? (
                        <ToggleRight className="h-8 w-8 text-red-500" />
                      ) : (
                        <ToggleLeft className="h-8 w-8 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                  <GlassButton variant="default" className="w-full" leftIcon={<RefreshCw className="h-4 w-4" />}>
                    Clear Cache
                  </GlassButton>
                  <GlassButton variant="default" className="w-full" leftIcon={<Download className="h-4 w-4" />}>
                    Export Data
                  </GlassButton>
                </div>
              </GlassCard>
            </div>
            
            {/* Save Button */}
            <div className="mt-6 flex justify-end">
              <GlassButton
                variant="primary"
                onClick={handleSaveSettings}
                isLoading={isProcessing}
                leftIcon={<Check className="h-4 w-4" />}
              >
                Save Settings
              </GlassButton>
            </div>
            
            {/* Settings Saved Message */}
            <AnimatePresence>
              {settingsSaved && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50"
                >
                  <Check className="h-4 w-4" />
                  Settings saved successfully!
                </motion.div>
              )}
            </AnimatePresence>
          </FadeIn>
        )}

        {/* Resolve Dispute Modal */}
        <AnimatePresence>
          {showResolveModal && selectedDispute && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => setShowResolveModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md"
              >
                <GlassCard variant="elevated" className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Resolve Dispute</h3>
                      <p className="text-sm text-muted-foreground">Choose a resolution</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4 mb-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Resolution Type</label>
                      <select
                        value={resolutionType}
                        onChange={(e) => setResolutionType(e.target.value as any)}
                        className="w-full h-10 px-3 rounded-lg border border-input bg-background/50"
                      >
                        <option value="FULL_REFUND">Full Refund</option>
                        <option value="PARTIAL_REFUND">Partial Refund</option>
                        <option value="NO_ACTION">No Action Needed</option>
                      </select>
                    </div>
                    
                    {resolutionType === 'PARTIAL_REFUND' && (
                      <div>
                        <label className="text-sm font-medium mb-2 block">Refund Amount</label>
                        <GlassInput
                          type="number"
                          value={partialRefundAmount}
                          onChange={(e) => setPartialRefundAmount(parseFloat(e.target.value))}
                          placeholder="Enter amount"
                        />
                      </div>
                    )}
                    
                    <div>
                      <label className="text-sm font-medium mb-2 block">Notes</label>
                      <textarea
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        placeholder="Add resolution notes..."
                        className="w-full h-24 p-3 rounded-lg border border-input bg-background/50 resize-none"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <GlassButton
                      variant="ghost"
                      className="flex-1"
                      onClick={() => setShowResolveModal(false)}
                    >
                      Cancel
                    </GlassButton>
                    <GlassButton
                      variant="primary"
                      className="flex-1"
                      onClick={handleResolveDispute}
                      disabled={isProcessing}
                      isLoading={isProcessing}
                    >
                      Resolve
                    </GlassButton>
                  </div>
                </GlassCard>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reject Modal */}
        <AnimatePresence>
          {showRejectModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => setShowRejectModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md"
              >
                <GlassCard variant="elevated" className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Reject Application</h3>
                      <p className="text-sm text-muted-foreground">Please provide a reason</p>
                    </div>
                  </div>
                  
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Enter the reason for rejection..."
                    className="w-full h-32 p-3 rounded-lg border border-input bg-background/50 resize-none mb-4"
                  />
                  
                  <div className="flex gap-3">
                    <GlassButton
                      variant="ghost"
                      className="flex-1"
                      onClick={() => setShowRejectModal(false)}
                    >
                      Cancel
                    </GlassButton>
                    <GlassButton
                      variant="outline"
                      className="flex-1 text-red-500 border-red-500 hover:bg-red-50"
                      onClick={handleReject}
                      disabled={!rejectReason.trim() || isProcessing}
                      isLoading={isProcessing}
                    >
                      Reject
                    </GlassButton>
                  </div>
                </GlassCard>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* User Details Modal */}
        <AnimatePresence>
          {showUserModal && selectedUser && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => setShowUserModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg"
              >
                <GlassCard variant="elevated" className="p-6">
                  {(() => {
                    const u = displayUsers.find(user => user.id === selectedUser);
                    if (!u) return null;
                    return (
                      <>
                        <div className="flex items-center gap-4 mb-6">
                          <div className="w-16 h-16 rounded-full gradient-bg flex items-center justify-center">
                            <span className="text-2xl font-bold text-white">{u.name.charAt(0)}</span>
                          </div>
                          <div>
                            <h3 className="text-xl font-semibold">{u.name}</h3>
                            <p className="text-sm text-muted-foreground">{u.email}</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-lg bg-muted/50">
                              <p className="text-xs text-muted-foreground mb-1">Role(s)</p>
                              <div className="flex flex-wrap gap-1">
                                {u.roles && u.roles.length > 1 ? (
                                  u.roles.map((r, idx) => (
                                    <GlassBadge key={idx} variant={r === 'BUSINESS_OWNER' ? 'primary' : 'default'} className="text-xs">
                                      {r === 'BUSINESS_OWNER' ? 'Provider' : 'Customer'}
                                    </GlassBadge>
                                  ))
                                ) : (
                                  <GlassBadge variant={u.role === 'BUSINESS_OWNER' ? 'primary' : 'default'}>
                                    {u.role === 'BUSINESS_OWNER' ? 'Provider' : 'Customer'}
                                  </GlassBadge>
                                )}
                              </div>
                            </div>
                            <div className="p-4 rounded-lg bg-muted/50">
                              <p className="text-xs text-muted-foreground mb-1">Status</p>
                              <GlassBadge variant={u.status === 'ACTIVE' ? 'success' : 'destructive'}>
                                {u.status}
                              </GlassBadge>
                            </div>
                          </div>

                          <div className="p-4 rounded-lg bg-muted/50">
                            <p className="text-xs text-muted-foreground mb-1">Joined</p>
                            <p className="font-medium">{u.joinedAt.toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                          </div>

                          {/* Show both spending and earnings for dual role users */}
                          <div className="grid grid-cols-2 gap-4">
                            {u.totalSpent !== undefined && (
                              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                                <p className="text-xs text-muted-foreground mb-1">Total Spent</p>
                                <p className="text-xl font-bold text-green-500">${u.totalSpent}</p>
                                <p className="text-xs text-muted-foreground">as Customer</p>
                              </div>
                            )}

                            {u.totalEarnings !== undefined && (
                              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <p className="text-xs text-muted-foreground mb-1">Total Earnings</p>
                                <p className="text-xl font-bold text-blue-500">${u.totalEarnings.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground">as Provider</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                          <GlassButton
                            variant="ghost"
                            className="flex-1"
                            onClick={() => setShowUserModal(false)}
                          >
                            Close
                          </GlassButton>
                          <GlassButton
                            variant="outline"
                            className={cn("flex-1", u.status === 'ACTIVE' && "text-red-500 border-red-500 hover:bg-red-500/10")}
                            onClick={() => {
                              handleToggleUserStatus(u.id);
                              setShowUserModal(false);
                            }}
                            leftIcon={u.status === 'ACTIVE' ? <Ban className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          >
                            {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                          </GlassButton>
                        </div>
                      </>
                    );
                  })()}
                </GlassCard>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dispute Respond Modal */}
        <AnimatePresence>
          {showDisputeModal && selectedDispute && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => setShowDisputeModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg"
              >
                <GlassCard variant="elevated" className="p-6">
                  {(() => {
                    const dispute = disputes.find(d => d.id === selectedDispute);
                    if (!dispute) return null;
                    return (
                      <>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <MessageSquare className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold">Respond to Dispute</h3>
                            <p className="text-sm text-muted-foreground">{dispute.type.replace('_', ' ')}</p>
                          </div>
                        </div>

                        <div className="p-4 rounded-lg bg-muted/50 mb-4">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Original Complaint</p>
                          <p className="text-sm">{dispute.description}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="p-3 rounded-lg bg-muted/30">
                            <p className="text-xs text-muted-foreground">Customer</p>
                            <p className="font-medium">{dispute.customerName}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/30">
                            <p className="text-xs text-muted-foreground">Provider</p>
                            <p className="font-medium">{dispute.providerName}</p>
                          </div>
                        </div>

                        <div className="mb-4">
                          <label className="text-sm font-medium mb-2 block">Your Response</label>
                          <textarea
                            value={disputeResponse}
                            onChange={(e) => setDisputeResponse(e.target.value)}
                            placeholder="Enter your response to this dispute..."
                            className="w-full h-32 p-3 rounded-lg border border-input bg-background/50 resize-none"
                          />
                        </div>

                        <div className="flex gap-3">
                          <GlassButton
                            variant="ghost"
                            className="flex-1"
                            onClick={() => {
                              setShowDisputeModal(false);
                              setDisputeResponse('');
                            }}
                          >
                            Cancel
                          </GlassButton>
                          <GlassButton
                            variant="primary"
                            className="flex-1"
                            onClick={handleSendDisputeResponse}
                            disabled={!disputeResponse.trim() || isProcessing}
                            isLoading={isProcessing}
                            leftIcon={<Send className="h-4 w-4" />}
                          >
                            Send Response
                          </GlassButton>
                        </div>
                      </>
                    );
                  })()}
                </GlassCard>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Listing Details/Edit Modal */}
        <AnimatePresence>
          {showListingModal && selectedListing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => setShowListingModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg"
              >
                <GlassCard variant="elevated" className="p-6">
                  {(() => {
                    const listing = premiumListings.find(l => l.id === selectedListing);
                    if (!listing) return null;
                    return (
                      <>
                        <div className="flex items-center gap-3 mb-4">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center",
                            listing.plan === 'FEATURED' ? "bg-yellow-500/20" : "bg-purple-500/20"
                          )}>
                            <Crown className={cn(
                              "h-5 w-5",
                              listing.plan === 'FEATURED' ? "text-yellow-500" : "text-purple-500"
                            )} />
                          </div>
                          <div>
                            <h3 className="font-semibold">Premium Listing Details</h3>
                            <p className="text-sm text-muted-foreground">{listing.businessName}</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium mb-2 block">Plan</label>
                              <select
                                value={listingEditData.plan}
                                onChange={(e) => setListingEditData(prev => ({ ...prev, plan: e.target.value }))}
                                className="w-full h-10 px-3 rounded-lg border border-input bg-background/50"
                              >
                                <option value="FEATURED">Featured</option>
                                <option value="PREMIUM">Premium</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-sm font-medium mb-2 block">Price ($/month)</label>
                              <GlassInput
                                type="number"
                                value={listingEditData.price}
                                onChange={(e) => setListingEditData(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium mb-2 block">End Date</label>
                            <GlassInput
                              type="date"
                              value={listingEditData.endDate}
                              onChange={(e) => setListingEditData(prev => ({ ...prev, endDate: e.target.value }))}
                            />
                          </div>

                          <div className="p-4 rounded-lg bg-muted/50">
                            <p className="text-xs font-medium text-muted-foreground mb-3">PERFORMANCE STATS</p>
                            <div className="grid grid-cols-3 gap-3 text-center">
                              <div>
                                <p className="text-lg font-bold">{listing.impressions.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground">Views</p>
                              </div>
                              <div>
                                <p className="text-lg font-bold">{listing.clicks}</p>
                                <p className="text-xs text-muted-foreground">Clicks</p>
                              </div>
                              <div>
                                <p className="text-lg font-bold">{listing.conversions}</p>
                                <p className="text-xs text-muted-foreground">Bookings</p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                            <span className="text-sm text-muted-foreground">Status</span>
                            <GlassBadge variant={listing.status === 'ACTIVE' ? 'success' : 'warning'}>
                              {listing.status}
                            </GlassBadge>
                          </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                          <GlassButton
                            variant="ghost"
                            className="flex-1"
                            onClick={() => setShowListingModal(false)}
                          >
                            Cancel
                          </GlassButton>
                          <GlassButton
                            variant="primary"
                            className="flex-1"
                            onClick={handleSaveListing}
                            isLoading={isProcessing}
                            leftIcon={<Check className="h-4 w-4" />}
                          >
                            Save Changes
                          </GlassButton>
                        </div>
                      </>
                    );
                  })()}
                </GlassCard>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AdminDashboard;
