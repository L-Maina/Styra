'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Scissors, 
  Users, 
  Calendar, 
  DollarSign,
  Settings,
  Image as ImageIcon,
  TrendingUp,
  Clock,
  Star,
  Plus,
  Edit3,
  Trash2,
  X,
  Check,
  AlertCircle,
  MapPin,
  Phone,
  Mail,
  Globe,
  Camera,
  Save,
  ChevronLeft,
  ChevronRight,
  Eye,
  Ban,
  Play,
  Pause,
  Power,
  RefreshCw,
  EyeOff,
  Upload,
  ZoomIn,
  Crown,
  Zap,
  ArrowUpRight,
  BarChart3,
  Package,
} from 'lucide-react';
import { 
  GlassCard, 
  GlassButton, 
  GlassInput,
  GlassBadge,
  FadeIn,
} from '@/components/ui/custom/glass-components';
import { PhoneInput } from '@/components/ui/custom/PhoneInput';
import { LocationAutocomplete } from '@/components/ui/custom/LocationAutocomplete';
import { useAuthStore, useBusinessDataStore } from '@/store';
import { useBusinessServices, useBusinessStaff } from '@/hooks/use-business-data';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/ui/brand-logo';
import { toast } from 'sonner';
import api from '@/lib/api-client';
import type { User, Service, Staff, Booking as ApiBooking } from '@/types';

interface BusinessDashboardProps {
  user: User | null;
  onNavigate?: (page: string) => void;
  bookings?: ApiBooking[];
}

type DashboardTab = 'overview' | 'services' | 'staff' | 'bookings' | 'earnings' | 'portfolio' | 'marketing' | 'settings';

const categories = [
  'Haircuts & Styling',
  'Beard Grooming',
  'Hair Coloring',
  'Nail Services',
  'Skin Care',
  'Makeup',
  'Spa & Wellness',
  'Massage',
];

export const BusinessDashboard: React.FC<BusinessDashboardProps> = ({
  user,
  onNavigate,
  bookings: apiBookings,
}) => {
  const { isAuthenticated } = useAuthStore();
  const { businesses, updateBusiness, toggleBusinessActive } = useBusinessDataStore();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Business ID - derived from user context
  const businessIds = Object.keys(businesses);
  const businessId = businessIds.length > 0 ? businessIds[0] : null;
  const businessData = businesses[businessId || ''];

  // Fetch real services and staff from API
  const { data: apiServices, isLoading: servicesLoading, refetch: refetchServices } = useBusinessServices(businessId);
  const { data: apiStaff, isLoading: staffLoading } = useBusinessStaff(businessId);

  // Business data state — derive from API data, allow local CRUD overrides
  const [localServices, setLocalServices] = useState<Service[]>([]);
  const [localStaff, setLocalStaff] = useState<Staff[]>([]);
  const services = apiServices.length > 0 ? apiServices : localServices;
  const staff = apiStaff.length > 0 ? apiStaff : localStaff;
  // Loading state: apiBookings is undefined while still loading
  const bookingsLoading = apiBookings === undefined;
  // Local status overrides for optimistic updates (e.g., confirm/cancel)
  const [localStatusOverrides, setLocalStatusOverrides] = useState<Record<string, ApiBooking['status']>>({});
  // Derive bookings from API data with local overrides applied
  const bookings: ApiBooking[] = (apiBookings || []).map(b =>
    localStatusOverrides[b.id] ? { ...b, status: localStatusOverrides[b.id] } : b
  );
  
  // Gallery state for portfolio
  const [gallery, setGallery] = useState<string[]>([
    'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=600&h=400&fit=crop',
    'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=600&h=400&fit=crop',
  ]);

  // Business profile state - synced with store
  const [businessProfile, setBusinessProfile] = useState({
    name: businessData?.name || 'Elite Cuts & Style',
    description: businessData?.description || 'Premium barbershop offering modern cuts, beard grooming, and style consultations. Our experienced team delivers precision cuts in a relaxed atmosphere.',
    phone: businessData?.phone || '+254 712 345 678',
    email: businessData?.email || 'contact@elitecuts.com',
    address: businessData?.address || '123 Style Avenue',
    city: businessData?.city || 'Nairobi',
    country: businessData?.country || 'Kenya',
    website: businessData?.website || 'www.elitecuts.com',
    latitude: businessData?.latitude || null,
    longitude: businessData?.longitude || null,
    isActive: businessData?.isActive ?? true,
    hours: businessData?.hours || {
      weekday: '9:00 AM - 7:00 PM',
      saturday: '10:00 AM - 5:00 PM',
      sunday: 'Closed',
    },
    // Photo fields (local state only, not synced with store)
    logo: '',
    coverImage: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1200&h=400&fit=crop',
  });

  // Modal states
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<ApiBooking | null>(null);

  // Drag and drop states
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [isDraggingGallery, setIsDraggingGallery] = useState(false);

  // File input refs
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [serviceForm, setServiceForm] = useState({
    name: '',
    description: '',
    category: 'Haircuts & Styling',
    duration: 30,
    price: 0,
    imageUrl: '',
  });

  const [staffForm, setStaffForm] = useState({
    name: '',
    role: '',
    bio: '',
  });

  // Filter states
  const [bookingFilter, setBookingFilter] = useState<'all' | 'today' | 'week' | 'month'>('today');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('all');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'bookings', label: 'Bookings', icon: Calendar },
    { id: 'services', label: 'Services', icon: Scissors },
    { id: 'staff', label: 'Staff', icon: Users },
    { id: 'portfolio', label: 'Portfolio', icon: ImageIcon },
    { id: 'marketing', label: 'Marketing', icon: Crown },
    { id: 'earnings', label: 'Earnings', icon: DollarSign },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // Stats calculation
  const totalBookings = bookings.length;
  const completedBookings = bookings.filter(b => b.status === 'COMPLETED').length;
  const pendingBookings = bookings.filter(b => b.status === 'PENDING').length;
  const totalRevenue = bookings.filter(b => b.status === 'COMPLETED').reduce((sum, b) => sum + b.totalAmount, 0);
  const averageRating = 4.9;

  // Show save message helper
  const showSaveMessage = (type: 'success' | 'error', text: string) => {
    setSaveMessage({ type, text });
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Handle file upload
  const handleFileUpload = async (
    file: File, 
    type: 'logo' | 'cover' | 'gallery'
  ): Promise<void> => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      
      if (type === 'logo') {
        setBusinessProfile(prev => ({ ...prev, logo: base64 }));
        toast.success('Logo uploaded successfully!');
      } else if (type === 'cover') {
        setBusinessProfile(prev => ({ ...prev, coverImage: base64 }));
        toast.success('Cover image uploaded successfully!');
      } else if (type === 'gallery') {
        setGallery(prev => [...prev, base64]);
        toast.success('Photo added to gallery!');
      }
    } catch {
      toast.error('Failed to upload image');
    }
  };

  // Handle drag events
  const handleDragOver = (e: React.DragEvent, setter: (value: boolean) => void) => {
    e.preventDefault();
    e.stopPropagation();
    setter(true);
  };

  const handleDragLeave = (e: React.DragEvent, setter: (value: boolean) => void) => {
    e.preventDefault();
    e.stopPropagation();
    setter(false);
  };

  const handleDrop = async (
    e: React.DragEvent, 
    type: 'logo' | 'cover' | 'gallery',
    setter: (value: boolean) => void
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setter(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      if (type === 'gallery') {
        for (const file of Array.from(files)) {
          await handleFileUpload(file, type);
        }
      } else {
        await handleFileUpload(files[0], type);
      }
    }
  };

  // Delete gallery image
  const handleDeleteGalleryImage = (index: number) => {
    setGallery(prev => prev.filter((_, i) => i !== index));
    toast.success('Photo removed from gallery!');
  };

  // View image in modal
  const handleViewImage = (image: string) => {
    setSelectedImage(image);
    setShowImageModal(true);
  };

  // Service CRUD
  const handleAddService = () => {
    setEditingService(null);
    setServiceForm({ name: '', description: '', category: 'Haircuts & Styling', duration: 30, price: 0, imageUrl: '' });
    setShowServiceModal(true);
  };

  const handleEditService = (service: Service) => {
    setEditingService(service);
    setServiceForm({
      name: service.name,
      description: service.description || '',
      category: service.category,
      duration: service.duration,
      price: service.price,
      imageUrl: service.imageUrl || '',
    });
    setShowServiceModal(true);
  };

  const handleSaveService = async () => {
    if (!businessId) {
      toast.error('No business found. Please create a business first.');
      return;
    }

    setIsLoading(true);
    try {
      const serviceData = {
        name: serviceForm.name,
        description: serviceForm.description,
        category: serviceForm.category,
        duration: serviceForm.duration,
        price: serviceForm.price,
        imageUrl: serviceForm.imageUrl || undefined,
      };

      if (editingService) {
        await api.updateService(editingService.id, serviceData);
        toast.success('Service updated successfully!');
      } else {
        await api.createService({ ...serviceData, businessId });
        toast.success('Service added successfully!');
      }

      setShowServiceModal(false);
      // Refresh services from API
      refetchServices();
    } catch {
      showSaveMessage('error', 'Failed to save service');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;

    setIsLoading(true);
    try {
      await api.request(`/services/${serviceId}`, { method: 'DELETE' });
      toast.success('Service deleted successfully!');
      // Refresh services from API
      refetchServices();
    } catch {
      showSaveMessage('error', 'Failed to delete service');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleService = async (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;

    try {
      await api.updateService(serviceId, { isActive: !service.isActive });
      toast.success('Service status updated!');
      // Refresh services from API
      refetchServices();
    } catch {
      showSaveMessage('error', 'Failed to update service status');
    }
  };

  // Staff CRUD
  const handleAddStaff = () => {
    setEditingStaff(null);
    setStaffForm({ name: '', role: '', bio: '' });
    setShowStaffModal(true);
  };

  const handleEditStaff = (member: Staff) => {
    setEditingStaff(member);
    setStaffForm({
      name: member.name,
      role: member.role,
      bio: member.bio || '',
    });
    setShowStaffModal(true);
  };

  // TODO: Connect to staff API route once backend is implemented.
  // Currently no /api/staff endpoint exists, so staff CRUD is local-only.
  const handleSaveStaff = () => {
    toast.info('Staff management requires backend setup');
    setIsLoading(true);
    setTimeout(() => {
      if (editingStaff) {
        setLocalStaff(prev => prev.map(s => 
          s.id === editingStaff.id 
            ? { ...s, ...staffForm, updatedAt: new Date() }
            : s
        ));
        showSaveMessage('success', 'Staff member updated successfully!');
      } else {
        const newStaff: Staff = {
          id: `st${Date.now()}`,
          businessId: 'b1',
          ...staffForm,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setLocalStaff(prev => [...prev, newStaff]);
        showSaveMessage('success', 'Staff member added successfully!');
      }
      setShowStaffModal(false);
      setIsLoading(false);
    }, 500);
  };

  const handleDeleteStaff = (staffId: string) => {
    if (confirm('Are you sure you want to remove this staff member?')) {
      setLocalStaff(prev => prev.filter(s => s.id !== staffId));
      showSaveMessage('success', 'Staff member removed successfully!');
    }
  };

  const handleToggleStaff = (staffId: string) => {
    setLocalStaff(prev => prev.map(s => 
      s.id === staffId ? { ...s, isActive: !s.isActive, updatedAt: new Date() } : s
    ));
    showSaveMessage('success', 'Staff status updated!');
  };

  // Booking management
  const handleViewBooking = (booking: ApiBooking) => {
    setSelectedBooking(booking);
    setShowBookingModal(true);
  };

  const handleUpdateBookingStatus = async (bookingId: string, status: ApiBooking['status']) => {
    setIsLoading(true);
    try {
      await api.updateBooking(bookingId, { status });
      // Optimistic update: apply the new status locally for immediate feedback
      setLocalStatusOverrides(prev => ({ ...prev, [bookingId]: status }));
      toast.success(`Booking ${status.toLowerCase()}!`);
      setShowBookingModal(false);
    } catch {
      showSaveMessage('error', 'Failed to update booking status');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter bookings
  const filteredBookings = bookings.filter(booking => {
    const statusMatch = bookingStatusFilter === 'all' || booking.status === bookingStatusFilter;
    return statusMatch;
  });

  // Get service/staff names — prefer API-included relations, fall back to local state
  const getServiceName = (serviceId: string, booking?: ApiBooking) => {
    if (booking?.service?.name) return booking.service.name;
    return services.find(s => s.id === serviceId)?.name || 'Unknown Service';
  };

  const getStaffName = (staffId: string | undefined, booking?: ApiBooking) => {
    if (!staffId) return 'Any';
    if (booking?.staff?.name) return booking.staff.name;
    return staff.find(s => s.id === staffId)?.name || 'Unknown';
  };

  // Get customer name from API-included relation
  const getCustomerName = (customerId: string, booking?: ApiBooking) => {
    if (booking?.customer?.name) return booking.customer.name;
    return 'Customer';
  };

  const getCustomerInitial = (customerId: string, booking?: ApiBooking) => {
    if (booking?.customer?.name) return booking.customer.name[0];
    return 'U';
  };

  // Save business profile
  const handleSaveProfile = () => {
    if (!businessId) return;
    setIsLoading(true);
    setTimeout(() => {
      // Update the store - this will reflect across the app
      updateBusiness(businessId, {
        name: businessProfile.name,
        description: businessProfile.description,
        phone: businessProfile.phone,
        email: businessProfile.email,
        address: businessProfile.address,
        city: businessProfile.city,
        country: businessProfile.country,
        website: businessProfile.website,
        latitude: businessProfile.latitude,
        longitude: businessProfile.longitude,
        isActive: businessProfile.isActive,
        hours: businessProfile.hours,
      });
      
      toast.success('Business profile updated! Changes are now live.');
      setIsLoading(false);
    }, 500);
  };
  
  // Toggle business active status
  const handleToggleBusinessActive = () => {
    if (!businessId) return;
    const newStatus = !businessProfile.isActive;
    setBusinessProfile(prev => ({ ...prev, isActive: newStatus }));
    toggleBusinessActive(businessId);
    
    if (newStatus) {
      toast.success('Business is now live and visible to customers!', {
        description: 'Your business will appear in search results and on the map.',
      });
    } else {
      toast.info('Business deactivated', {
        description: 'Your business is now hidden from customers. You can reactivate anytime.',
      });
    }
  };

  // Stats for overview
  const stats = [
    { label: 'Total Bookings', value: totalBookings.toString(), change: '+12%', icon: Calendar, color: 'from-blue-500 to-cyan-500' },
    { label: 'Revenue', value: `$${totalRevenue.toLocaleString()}`, change: '+23%', icon: DollarSign, color: 'from-green-500 to-emerald-500' },
    { label: 'Active Services', value: services.filter(s => s.isActive).length.toString(), change: '+2', icon: Scissors, color: 'from-purple-500 to-pink-500' },
    { label: 'Rating', value: averageRating.toString(), change: '+0.2', icon: Star, color: 'from-yellow-500 to-orange-500' },
  ];

  // Redirect if not authenticated or not a business owner
  const hasBusinessRole = user?.roles?.includes('BUSINESS_OWNER') || user?.role === 'BUSINESS_OWNER';
  
  if (!isAuthenticated || !user || !hasBusinessRole) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <GlassCard className="p-8 text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">
            {!user 
              ? 'Please log in to access your business dashboard' 
              : 'You need to register as a business owner to access this dashboard'}
          </p>
          <div className="flex gap-2 justify-center">
            {!user && (
              <GlassButton variant="primary" onClick={() => onNavigate?.('login')}>
                Sign In
              </GlassButton>
            )}
            {user && !hasBusinessRole && (
              <GlassButton variant="primary" onClick={() => onNavigate?.('onboarding')}>
                Become a Provider
              </GlassButton>
            )}
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen py-8"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <FadeIn>
          <div className="flex items-start gap-3 mb-8">
            <BrandLogo variant="icon" size={40} className="hidden sm:block shrink-0 mt-1" />
            <div>
              <h1 className="text-3xl font-bold mb-2">
                Business <span className="gradient-text">Dashboard</span>
              </h1>
              <p className="text-muted-foreground">
                Welcome back, {user?.name || 'Business Owner'}! Manage your business, services, and bookings.
              </p>
            </div>
          </div>
        </FadeIn>

        {/* Save Message */}
        <AnimatePresence>
          {saveMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={cn(
                'fixed top-20 right-4 z-50 px-4 py-3 rounded-lg shadow-lg',
                saveMessage.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
              )}
            >
              <div className="flex items-center gap-2">
                {saveMessage.type === 'success' ? <Check className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                {saveMessage.text}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <FadeIn delay={0.1}>
            <GlassCard variant="default" className="p-4 h-fit lg:sticky lg:top-24">
              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as DashboardTab)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                      activeTab === tab.id
                        ? 'gradient-bg text-white'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <tab.icon className="h-5 w-5" />
                    <span>{tab.label}</span>
                    {tab.id === 'bookings' && pendingBookings > 0 && (
                      <GlassBadge variant="warning" className="ml-auto">{pendingBookings}</GlassBadge>
                    )}
                  </button>
                ))}
              </nav>
            </GlassCard>
          </FadeIn>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {stats.map((stat, index) => (
                    <FadeIn key={stat.label} delay={0.1 * (index + 1)}>
                      <GlassCard variant="default" className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                            <stat.icon className="h-5 w-5 text-white" />
                          </div>
                          <span className="text-xs text-green-600 font-medium">{stat.change}</span>
                        </div>
                        <div className="text-2xl font-bold">{stat.value}</div>
                        <div className="text-sm text-muted-foreground">{stat.label}</div>
                      </GlassCard>
                    </FadeIn>
                  ))}
                </div>

                {/* Today's Bookings */}
                <FadeIn delay={0.3}>
                  <GlassCard variant="default" className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">Today&apos;s Appointments</h3>
                      <GlassButton variant="ghost" size="sm" onClick={() => setActiveTab('bookings')}>
                        View All
                      </GlassButton>
                    </div>
                    <div className="space-y-3">
                      {bookings.length === 0 && bookingsLoading ? (
                        <div className="space-y-3">
                          {[...Array(4)].map((_, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 animate-pulse">
                              <div className="w-10 h-10 rounded-full bg-muted" />
                              <div className="flex-1">
                                <div className="h-4 w-28 bg-muted rounded mb-1" />
                                <div className="h-3 w-36 bg-muted rounded" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : bookings.slice(0, 4).map((booking) => (
                        <div 
                          key={booking.id} 
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors cursor-pointer"
                          onClick={() => handleViewBooking(booking)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center text-white font-medium">
                              {getCustomerInitial(booking.customerId, booking)}
                            </div>
                            <div>
                              <div className="font-medium">{getCustomerName(booking.customerId, booking)}</div>
                              <div className="text-sm text-muted-foreground">{getServiceName(booking.serviceId, booking)}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{booking.startTime}</div>
                            <GlassBadge variant={
                              booking.status === 'CONFIRMED' ? 'success' :
                              booking.status === 'PENDING' ? 'warning' :
                              booking.status === 'COMPLETED' ? 'default' : 'destructive'
                            }>
                              {booking.status}
                            </GlassBadge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                </FadeIn>

                {/* Quick Actions */}
                <FadeIn delay={0.4}>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <GlassCard variant="default" className="p-4 cursor-pointer hover:shadow-lg" onClick={handleAddService}>
                      <div className="flex items-center gap-3">
                        <Plus className="h-5 w-5 text-primary" />
                        <span>Add Service</span>
                      </div>
                    </GlassCard>
                    <GlassCard variant="default" className="p-4 cursor-pointer hover:shadow-lg" onClick={handleAddStaff}>
                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-primary" />
                        <span>Add Staff Member</span>
                      </div>
                    </GlassCard>
                    <GlassCard variant="default" className="p-4 cursor-pointer hover:shadow-lg" onClick={() => galleryInputRef.current?.click()}>
                      <div className="flex items-center gap-3">
                        <Camera className="h-5 w-5 text-primary" />
                        <span>Add to Portfolio</span>
                      </div>
                    </GlassCard>
                  </div>
                </FadeIn>

                {/* Active Staff */}
                <FadeIn delay={0.5}>
                  <GlassCard variant="default" className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">Active Staff</h3>
                      <GlassButton variant="ghost" size="sm" onClick={() => setActiveTab('staff')}>
                        Manage
                      </GlassButton>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {staff.filter(s => s.isActive).map((member) => (
                        <div key={member.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
                          <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center text-white text-sm font-medium">
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <div className="text-sm font-medium">{member.name}</div>
                            <div className="text-xs text-muted-foreground">{member.role}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                </FadeIn>
              </div>
            )}

            {/* Services Tab */}
            {activeTab === 'services' && (
              <div className="space-y-4">
                <FadeIn>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Services ({services.length})</h2>
                    <GlassButton variant="primary" onClick={handleAddService}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Service
                    </GlassButton>
                  </div>
                </FadeIn>

                <div className="grid gap-4">
                  {services.map((service, index) => (
                    <FadeIn key={service.id} delay={0.05 * index}>
                      <GlassCard variant="default" className={cn(
                        'p-4 transition-all',
                        !service.isActive && 'opacity-60'
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center overflow-hidden">
                              {service.imageUrl ? (
                                <img src={service.imageUrl} alt={service.name} className="w-full h-full object-cover" />
                              ) : (
                                <Scissors className="h-6 w-6 text-primary" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{service.name}</h3>
                                {!service.isActive && (
                                  <GlassBadge variant="destructive">Inactive</GlassBadge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span>{service.category}</span>
                                <span>•</span>
                                <span>{service.duration} min</span>
                                <span>•</span>
                                <span>{service.description?.slice(0, 40)}...</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xl font-bold text-primary">${service.price}</span>
                            <GlassButton 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleToggleService(service.id)}
                            >
                              {service.isActive ? <Ban className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                            </GlassButton>
                            <GlassButton 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEditService(service)}
                            >
                              <Edit3 className="h-4 w-4" />
                            </GlassButton>
                            <GlassButton 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDeleteService(service.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </GlassButton>
                          </div>
                        </div>
                      </GlassCard>
                    </FadeIn>
                  ))}
                </div>
              </div>
            )}

            {/* Staff Tab */}
            {activeTab === 'staff' && (
              <div className="space-y-4">
                <FadeIn>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Staff Members ({staff.length})</h2>
                    <GlassButton variant="primary" onClick={handleAddStaff}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Staff
                    </GlassButton>
                  </div>
                </FadeIn>

                <div className="grid sm:grid-cols-2 gap-4">
                  {staff.map((member, index) => (
                    <FadeIn key={member.id} delay={0.05 * index}>
                      <GlassCard variant="default" className={cn(
                        'p-4',
                        !member.isActive && 'opacity-60'
                      )}>
                        <div className="flex items-start gap-4">
                          <div className="w-14 h-14 rounded-full gradient-bg flex items-center justify-center text-white font-bold text-lg shrink-0">
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{member.name}</h3>
                              {!member.isActive && (
                                <GlassBadge variant="destructive">Inactive</GlassBadge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{member.role}</p>
                            <p className="text-xs text-muted-foreground mt-1 truncate">{member.bio}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-border">
                          <GlassButton 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleToggleStaff(member.id)}
                          >
                            {member.isActive ? <Ban className="h-4 w-4 mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                            {member.isActive ? 'Deactivate' : 'Activate'}
                          </GlassButton>
                          <GlassButton 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditStaff(member)}
                          >
                            <Edit3 className="h-4 w-4 mr-1" />
                            Edit
                          </GlassButton>
                          <GlassButton 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteStaff(member.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </GlassButton>
                        </div>
                      </GlassCard>
                    </FadeIn>
                  ))}
                </div>
              </div>
            )}

            {/* Bookings Tab */}
            {activeTab === 'bookings' && (
              <div className="space-y-4">
                <FadeIn>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <h2 className="text-xl font-semibold">Bookings</h2>
                    <div className="flex flex-wrap gap-2">
                      <div className="flex gap-1 p-1 rounded-lg bg-muted/50">
                        {(['today', 'week', 'month', 'all'] as const).map((filter) => (
                          <button
                            key={filter}
                            onClick={() => setBookingFilter(filter)}
                            className={cn(
                              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                              bookingFilter === filter
                                ? 'bg-background shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            {filter.charAt(0).toUpperCase() + filter.slice(1)}
                          </button>
                        ))}
                      </div>
                      <select
                        value={bookingStatusFilter}
                        onChange={(e) => setBookingStatusFilter(e.target.value)}
                        className="h-9 px-3 rounded-lg border border-input bg-background text-sm"
                      >
                        <option value="all">All Status</option>
                        <option value="PENDING">Pending</option>
                        <option value="CONFIRMED">Confirmed</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </div>
                  </div>
                </FadeIn>

                <div className="grid gap-3">
                  {bookingsLoading ? (
                    <div className="space-y-3">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="p-4 rounded-xl bg-muted/30 animate-pulse">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-muted" />
                            <div className="flex-1">
                              <div className="h-4 w-28 bg-muted rounded mb-1" />
                              <div className="h-3 w-48 bg-muted rounded" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : filteredBookings.length === 0 ? (
                    <GlassCard className="p-8 text-center">
                      <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No bookings found</p>
                    </GlassCard>
                  ) : (
                    filteredBookings.map((booking, index) => (
                      <FadeIn key={booking.id} delay={0.03 * index}>
                        <GlassCard 
                          variant="default" 
                          className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
                          onClick={() => handleViewBooking(booking)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full gradient-bg flex items-center justify-center text-white font-medium">
                                {getCustomerInitial(booking.customerId, booking)}
                              </div>
                              <div>
                                <h3 className="font-semibold">{getCustomerName(booking.customerId, booking)}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {getServiceName(booking.serviceId, booking)} • {getStaffName(booking.staffId, booking)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className="font-medium">${booking.totalAmount}</div>
                                <div className="text-sm text-muted-foreground">
                                  {booking.date} • {booking.startTime}
                                </div>
                              </div>
                              <GlassBadge variant={
                                booking.status === 'CONFIRMED' ? 'success' :
                                booking.status === 'PENDING' ? 'warning' :
                                booking.status === 'IN_PROGRESS' ? 'primary' :
                                booking.status === 'COMPLETED' ? 'default' : 'destructive'
                              }>
                                {booking.status}
                              </GlassBadge>
                            </div>
                          </div>
                        </GlassCard>
                      </FadeIn>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Earnings Tab */}
            {activeTab === 'earnings' && (
              <div className="space-y-6">
                <FadeIn>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <GlassCard variant="default" className="p-6 text-center">
                      <p className="text-muted-foreground mb-2">Today</p>
                      <div className="text-2xl font-bold">$285</div>
                      <p className="text-sm text-green-600 mt-1">+15% from yesterday</p>
                    </GlassCard>
                    <GlassCard variant="default" className="p-6 text-center">
                      <p className="text-muted-foreground mb-2">This Week</p>
                      <div className="text-2xl font-bold">$1,450</div>
                      <p className="text-sm text-green-600 mt-1">+23% from last week</p>
                    </GlassCard>
                    <GlassCard variant="default" className="p-6 text-center">
                      <p className="text-muted-foreground mb-2">This Month</p>
                      <div className="text-2xl font-bold gradient-text">$5,250</div>
                      <p className="text-sm text-green-600 mt-1">+18% from last month</p>
                    </GlassCard>
                  </div>
                </FadeIn>

                <FadeIn delay={0.1}>
                  <GlassCard variant="default" className="p-6">
                    <h3 className="font-semibold mb-4">Revenue Overview</h3>
                    <div className="h-64 bg-muted/30 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <TrendingUp className="h-12 w-12 text-primary mx-auto mb-2" />
                        <p className="text-muted-foreground">Revenue trending upward</p>
                        <p className="text-2xl font-bold mt-2">$12,450</p>
                        <p className="text-sm text-muted-foreground">Total Earnings</p>
                      </div>
                    </div>
                  </GlassCard>
                </FadeIn>

                <FadeIn delay={0.2}>
                  <GlassCard variant="default" className="p-6">
                    <h3 className="font-semibold mb-4">Recent Transactions</h3>
                    <div className="space-y-3">
                      {bookings.filter(b => b.status === 'COMPLETED').slice(0, 5).map((booking) => (
                        <div key={booking.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                              <DollarSign className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                              <p className="font-medium">{getServiceName(booking.serviceId, booking)}</p>
                              <p className="text-sm text-muted-foreground">{getCustomerName(booking.customerId, booking)}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-green-600">+${booking.totalAmount}</p>
                            <p className="text-sm text-muted-foreground">{booking.date}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                </FadeIn>
              </div>
            )}

            {/* Portfolio Tab */}
            {activeTab === 'portfolio' && (
              <div className="space-y-4">
                <FadeIn>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Portfolio ({gallery.length})</h2>
                    <GlassButton variant="primary" onClick={() => galleryInputRef.current?.click()}>
                      <Camera className="h-4 w-4 mr-2" />
                      Add Photo
                    </GlassButton>
                  </div>
                </FadeIn>

                <FadeIn delay={0.1}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {gallery.map((image, index) => (
                      <div
                        key={index}
                        className="aspect-square rounded-xl overflow-hidden relative group cursor-pointer"
                        onClick={() => handleViewImage(image)}
                      >
                        <img 
                          src={image} 
                          alt={`Portfolio ${index + 1}`}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <p className="text-white text-sm">Photo {index + 1}</p>
                          </div>
                          <div className="absolute top-2 right-2 flex gap-1">
                            <button 
                              className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewImage(image);
                              }}
                            >
                              <ZoomIn className="h-4 w-4" />
                            </button>
                            <button 
                              className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm text-white hover:bg-red-500/70 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteGalleryImage(index);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* Add Photo Button */}
                    <div 
                      className={cn(
                        "aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all",
                        isDraggingGallery 
                          ? "border-primary bg-primary/10" 
                          : "border-border hover:border-primary/50"
                      )}
                      onClick={() => galleryInputRef.current?.click()}
                      onDragOver={(e) => handleDragOver(e, setIsDraggingGallery)}
                      onDragLeave={(e) => handleDragLeave(e, setIsDraggingGallery)}
                      onDrop={(e) => handleDrop(e, 'gallery', setIsDraggingGallery)}
                    >
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Add Photo</span>
                      <span className="text-xs text-muted-foreground mt-1">or drag & drop</span>
                    </div>
                  </div>
                </FadeIn>

                {/* Hidden file input for gallery */}
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (files) {
                      for (const file of Array.from(files)) {
                        await handleFileUpload(file, 'gallery');
                      }
                    }
                    e.target.value = '';
                  }}
                />
              </div>
            )}

            {/* Marketing Tab - Premium Listings */}
            {activeTab === 'marketing' && (
              <div className="space-y-6">
                <FadeIn>
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold mb-2">Boost Your Business</h2>
                    <p className="text-muted-foreground">
                      Get more visibility and attract more customers with premium listings
                    </p>
                  </div>
                </FadeIn>

                {/* Current Plan */}
                <FadeIn delay={0.1}>
                  <GlassCard variant="default" className="p-6 border-primary/30">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                          <Package className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Current Plan</h3>
                          <p className="text-sm text-muted-foreground">Your active promotions</p>
                        </div>
                      </div>
                      <GlassBadge variant="primary">Free</GlassBadge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      You're on the free plan. Upgrade to get featured in search results and attract more customers.
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Average visibility:</span>
                      <span className="font-medium">Standard</span>
                    </div>
                  </GlassCard>
                </FadeIn>

                {/* Premium Plans */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Premium Plan */}
                  <FadeIn delay={0.2}>
                    <GlassCard variant="elevated" className="p-6 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                      <div className="relative">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                            <Zap className="h-6 w-6 text-purple-500" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">Premium</h3>
                            <p className="text-sm text-muted-foreground">Get more visibility</p>
                          </div>
                        </div>

                        <div className="mb-6">
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold">$49</span>
                            <span className="text-muted-foreground">/month</span>
                          </div>
                        </div>

                        <ul className="space-y-3 mb-6">
                          <li className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500" />
                            <span>Highlighted in search results</span>
                          </li>
                          <li className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500" />
                            <span>Priority listing in your category</span>
                          </li>
                          <li className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500" />
                            <span>Basic analytics dashboard</span>
                          </li>
                          <li className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500" />
                            <span>Email support</span>
                          </li>
                        </ul>

                        <GlassButton 
                          variant="primary" 
                          className="w-full"
                          onClick={() => toast.success('Premium plan coming soon!')}
                        >
                          Upgrade to Premium
                        </GlassButton>
                      </div>
                    </GlassCard>
                  </FadeIn>

                  {/* Featured Plan */}
                  <FadeIn delay={0.3}>
                    <GlassCard variant="elevated" className="p-6 relative overflow-hidden border-yellow-500/30">
                      <div className="absolute top-0 left-0 right-0 h-1 gradient-bg" />
                      <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                      
                      {/* Popular Badge */}
                      <div className="absolute top-4 right-4">
                        <GlassBadge variant="primary" className="text-xs">Most Popular</GlassBadge>
                      </div>

                      <div className="relative">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                            <Crown className="h-6 w-6 text-yellow-500" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">Featured</h3>
                            <p className="text-sm text-muted-foreground">Maximum exposure</p>
                          </div>
                        </div>

                        <div className="mb-6">
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold">$99</span>
                            <span className="text-muted-foreground">/month</span>
                          </div>
                        </div>

                        <ul className="space-y-3 mb-6">
                          <li className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500" />
                            <span>Featured badge on your profile</span>
                          </li>
                          <li className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500" />
                            <span>Top of search results</span>
                          </li>
                          <li className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500" />
                            <span>Advanced analytics & insights</span>
                          </li>
                          <li className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500" />
                            <span>Priority customer support</span>
                          </li>
                          <li className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500" />
                            <span>Promote on social media</span>
                          </li>
                        </ul>

                        <GlassButton 
                          variant="primary" 
                          className="w-full gradient-bg"
                          onClick={() => toast.success('Featured plan coming soon!')}
                        >
                          Upgrade to Featured
                        </GlassButton>
                      </div>
                    </GlassCard>
                  </FadeIn>
                </div>

                {/* Marketing Add-ons */}
                <FadeIn delay={0.4}>
                  <GlassCard variant="default" className="p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Zap className="h-5 w-5 text-primary" />
                      Marketing Add-ons
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors cursor-pointer">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">Social Media Boost</span>
                          <span className="font-bold text-primary">$25</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Get promoted on our social media channels for a week
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors cursor-pointer">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">Email Campaign</span>
                          <span className="font-bold text-primary">$35</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Featured in our weekly newsletter to subscribers
                        </p>
                      </div>
                    </div>
                  </GlassCard>
                </FadeIn>

                {/* Performance Stats */}
                <FadeIn delay={0.5}>
                  <GlassCard variant="default" className="p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Your Performance
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="text-center p-4 rounded-lg bg-muted/30">
                        <p className="text-2xl font-bold text-primary">1,542</p>
                        <p className="text-sm text-muted-foreground">Profile Views</p>
                        <p className="text-xs text-green-500 flex items-center justify-center gap-1 mt-1">
                          <ArrowUpRight className="h-3 w-3" /> +18%
                        </p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted/30">
                        <p className="text-2xl font-bold text-primary">89</p>
                        <p className="text-sm text-muted-foreground">Inquiries</p>
                        <p className="text-xs text-green-500 flex items-center justify-center gap-1 mt-1">
                          <ArrowUpRight className="h-3 w-3" /> +24%
                        </p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted/30">
                        <p className="text-2xl font-bold text-primary">45</p>
                        <p className="text-sm text-muted-foreground">Bookings</p>
                        <p className="text-xs text-green-500 flex items-center justify-center gap-1 mt-1">
                          <ArrowUpRight className="h-3 w-3" /> +12%
                        </p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted/30">
                        <p className="text-2xl font-bold text-primary">4.9</p>
                        <p className="text-sm text-muted-foreground">Avg Rating</p>
                        <p className="text-xs text-green-500 flex items-center justify-center gap-1 mt-1">
                          <ArrowUpRight className="h-3 w-3" /> +0.2
                        </p>
                      </div>
                    </div>
                  </GlassCard>
                </FadeIn>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                {/* Business Status Card */}
                <FadeIn>
                  <GlassCard variant={businessProfile.isActive ? "default" : "elevated"} className={cn(
                    "p-6 border-2",
                    businessProfile.isActive ? "border-green-500/30" : "border-orange-500/30"
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-14 h-14 rounded-full flex items-center justify-center",
                          businessProfile.isActive 
                            ? "bg-green-500/20" 
                            : "bg-orange-500/20"
                        )}>
                          {businessProfile.isActive ? (
                            <Play className="h-7 w-7 text-green-600" />
                          ) : (
                            <Pause className="h-7 w-7 text-orange-600" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">
                            Business is {businessProfile.isActive ? 'Live' : 'Deactivated'}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {businessProfile.isActive 
                              ? 'Your business is visible to customers and accepting bookings'
                              : 'Your business is hidden from customers. Reactivate to accept bookings'}
                          </p>
                        </div>
                      </div>
                      <GlassButton
                        variant={businessProfile.isActive ? "outline" : "primary"}
                        onClick={handleToggleBusinessActive}
                        className={cn("gap-2", businessProfile.isActive && "text-red-500 border-red-500 hover:bg-red-500/10")}
                      >
                        <Power className="h-4 w-4" />
                        {businessProfile.isActive ? 'Deactivate' : 'Activate'}
                      </GlassButton>
                    </div>
                  </GlassCard>
                </FadeIn>

                {/* Photos Section */}
                <FadeIn delay={0.1}>
                  <GlassCard variant="default" className="p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Camera className="h-5 w-5" />
                      Photos
                    </h3>
                    <div className="space-y-6">
                      {/* Logo Upload */}
                      <div>
                        <label className="text-sm font-medium mb-2 block">Business Logo</label>
                        <div className="flex items-center gap-4">
                          <div 
                            className={cn(
                              "w-20 h-20 rounded-full border-2 border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden",
                              isDraggingLogo 
                                ? "border-primary bg-primary/10" 
                                : "border-border hover:border-primary/50"
                            )}
                            onClick={() => logoInputRef.current?.click()}
                            onDragOver={(e) => handleDragOver(e, setIsDraggingLogo)}
                            onDragLeave={(e) => handleDragLeave(e, setIsDraggingLogo)}
                            onDrop={(e) => handleDrop(e, 'logo', setIsDraggingLogo)}
                          >
                            {businessProfile.logo ? (
                              <img 
                                src={businessProfile.logo} 
                                alt="Logo" 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Camera className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-muted-foreground">
                              Upload a square logo for your business. This will be displayed in your business card.
                            </p>
                            <div className="flex gap-2 mt-2">
                              <GlassButton 
                                variant="ghost" 
                                size="sm"
                                onClick={() => logoInputRef.current?.click()}
                              >
                                <Upload className="h-4 w-4 mr-1" />
                                Upload
                              </GlassButton>
                              {businessProfile.logo && (
                                <GlassButton 
                                  variant="ghost" 
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setBusinessProfile(prev => ({ ...prev, logo: '' }))}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Remove
                                </GlassButton>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Cover Image Upload */}
                      <div>
                        <label className="text-sm font-medium mb-2 block">Cover Image</label>
                        <div 
                          className={cn(
                            "w-full h-40 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden relative",
                            isDraggingCover 
                              ? "border-primary bg-primary/10" 
                              : "border-border hover:border-primary/50"
                          )}
                          onClick={() => coverInputRef.current?.click()}
                          onDragOver={(e) => handleDragOver(e, setIsDraggingCover)}
                          onDragLeave={(e) => handleDragLeave(e, setIsDraggingCover)}
                          onDrop={(e) => handleDrop(e, 'cover', setIsDraggingCover)}
                        >
                          {businessProfile.coverImage ? (
                            <>
                              <img 
                                src={businessProfile.coverImage} 
                                alt="Cover" 
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                <div className="flex gap-2">
                                  <GlassButton 
                                    variant="ghost" 
                                    size="sm"
                                    className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30"
                                    onClick={() => {
                                      coverInputRef.current?.click();
                                    }}
                                  >
                                    <Upload className="h-4 w-4 mr-1" />
                                    Change
                                  </GlassButton>
                                  <GlassButton 
                                    variant="ghost" 
                                    size="sm"
                                    className="bg-red-500/50 backdrop-blur-sm text-white hover:bg-red-500/70"
                                    onClick={() => {
                                      setBusinessProfile(prev => ({ ...prev, coverImage: '' }));
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </GlassButton>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="text-center">
                              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                              <p className="text-sm text-muted-foreground">Click or drag to upload cover image</p>
                              <p className="text-xs text-muted-foreground mt-1">Recommended: 1200 x 400px</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Gallery Preview */}
                      <div>
                        <label className="text-sm font-medium mb-2 block">Gallery / Portfolio</label>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                          {gallery.slice(0, 5).map((image, index) => (
                            <div 
                              key={index}
                              className="aspect-square rounded-lg overflow-hidden relative group cursor-pointer"
                              onClick={() => handleViewImage(image)}
                            >
                              <img 
                                src={image} 
                                alt={`Gallery ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button
                                  className="p-1 rounded bg-red-500/70 text-white hover:bg-red-500"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteGalleryImage(index);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                          {gallery.length > 5 && (
                            <div 
                              className="aspect-square rounded-lg bg-muted/50 flex items-center justify-center cursor-pointer hover:bg-muted/70 transition-colors"
                              onClick={() => setActiveTab('portfolio')}
                            >
                              <span className="text-sm font-medium">+{gallery.length - 5}</span>
                            </div>
                          )}
                          <div 
                            className={cn(
                              "aspect-square rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-all",
                              isDraggingGallery 
                                ? "border-primary bg-primary/10" 
                                : "border-border hover:border-primary/50"
                            )}
                            onClick={() => galleryInputRef.current?.click()}
                            onDragOver={(e) => handleDragOver(e, setIsDraggingGallery)}
                            onDragLeave={(e) => handleDragLeave(e, setIsDraggingGallery)}
                            onDrop={(e) => handleDrop(e, 'gallery', setIsDraggingGallery)}
                          >
                            <Plus className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {gallery.length} photos in gallery. Click to view in portfolio tab.
                        </p>
                      </div>
                    </div>

                    {/* Hidden file inputs */}
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          await handleFileUpload(file, 'logo');
                        }
                        e.target.value = '';
                      }}
                    />
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          await handleFileUpload(file, 'cover');
                        }
                        e.target.value = '';
                      }}
                    />
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (files) {
                          for (const file of Array.from(files)) {
                            await handleFileUpload(file, 'gallery');
                          }
                        }
                        e.target.value = '';
                      }}
                    />
                  </GlassCard>
                </FadeIn>

                {/* Business Information */}
                <FadeIn delay={0.2}>
                  <GlassCard variant="default" className="p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Business Information
                    </h3>
                    <div className="grid gap-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Business Name</label>
                          <GlassInput
                            value={businessProfile.name}
                            onChange={(e) => setBusinessProfile(prev => ({ ...prev, name: e.target.value }))}
                            leftIcon={<Scissors className="h-4 w-4" />}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Phone Number</label>
                          <PhoneInput
                            value={businessProfile.phone}
                            onChange={(value) => setBusinessProfile(prev => ({ ...prev, phone: value }))}
                            placeholder="+254 7XX XXX XXX"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Auto-formatted with country code
                          </p>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Description</label>
                        <textarea
                          value={businessProfile.description}
                          onChange={(e) => setBusinessProfile(prev => ({ ...prev, description: e.target.value }))}
                          className="w-full h-24 px-3 py-2 rounded-lg border border-input bg-background/50 backdrop-blur-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Email</label>
                          <GlassInput
                            type="email"
                            value={businessProfile.email}
                            onChange={(e) => setBusinessProfile(prev => ({ ...prev, email: e.target.value }))}
                            leftIcon={<Mail className="h-4 w-4" />}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Website</label>
                          <GlassInput
                            value={businessProfile.website}
                            onChange={(e) => setBusinessProfile(prev => ({ ...prev, website: e.target.value }))}
                            leftIcon={<Globe className="h-4 w-4" />}
                          />
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </FadeIn>

                {/* Location with Autocomplete */}
                <FadeIn delay={0.3}>
                  <GlassCard variant="default" className="p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Location
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Business Address</label>
                        <LocationAutocomplete
                          value={businessProfile.address}
                          onChange={(value, location) => {
                            setBusinessProfile(prev => ({
                              ...prev,
                              address: value,
                              latitude: location?.lat ?? prev.latitude,
                              longitude: location?.lng ?? prev.longitude,
                            }));
                          }}
                          onCityChange={(city) => setBusinessProfile(prev => ({ ...prev, city }))}
                          onCountryChange={(country) => setBusinessProfile(prev => ({ ...prev, country }))}
                          placeholder="Search for your business address..."
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Click the navigation icon to auto-detect your location
                        </p>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">City</label>
                          <GlassInput
                            value={businessProfile.city}
                            onChange={(e) => setBusinessProfile(prev => ({ ...prev, city: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Country</label>
                          <GlassInput
                            value={businessProfile.country}
                            onChange={(e) => setBusinessProfile(prev => ({ ...prev, country: e.target.value }))}
                          />
                        </div>
                      </div>
                      {businessProfile.latitude && businessProfile.longitude && (
                        <div className="p-3 rounded-lg bg-muted/50 flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-green-600" />
                          <span className="text-muted-foreground">Coordinates:</span>
                          <span className="font-mono">
                            {businessProfile.latitude.toFixed(4)}, {businessProfile.longitude.toFixed(4)}
                          </span>
                        </div>
                      )}
                    </div>
                  </GlassCard>
                </FadeIn>

                {/* Business Hours */}
                <FadeIn delay={0.4}>
                  <GlassCard variant="default" className="p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Business Hours
                    </h3>
                    <div className="space-y-4">
                      <div className="grid sm:grid-cols-3 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Monday - Friday</label>
                          <GlassInput
                            value={businessProfile.hours.weekday}
                            onChange={(e) => setBusinessProfile(prev => ({
                              ...prev,
                              hours: { ...prev.hours, weekday: e.target.value }
                            }))}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Saturday</label>
                          <GlassInput
                            value={businessProfile.hours.saturday}
                            onChange={(e) => setBusinessProfile(prev => ({
                              ...prev,
                              hours: { ...prev.hours, saturday: e.target.value }
                            }))}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Sunday</label>
                          <GlassInput
                            value={businessProfile.hours.sunday}
                            onChange={(e) => setBusinessProfile(prev => ({
                              ...prev,
                              hours: { ...prev.hours, sunday: e.target.value }
                            }))}
                          />
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </FadeIn>

                {/* Save Button */}
                <FadeIn delay={0.5}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Changes will be reflected across the app immediately
                    </p>
                    <GlassButton variant="primary" size="lg" onClick={handleSaveProfile} isLoading={isLoading}>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </GlassButton>
                  </div>
                </FadeIn>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Service Modal */}
      <AnimatePresence>
        {showServiceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setShowServiceModal(false)}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-background/95 border border-border/50 rounded-2xl p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">
                  {editingService ? 'Edit Service' : 'Add New Service'}
                </h2>
                <button onClick={() => setShowServiceModal(false)} className="p-2 hover:bg-muted rounded-lg">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Service Name</label>
                  <GlassInput
                    value={serviceForm.name}
                    onChange={(e) => setServiceForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Classic Haircut"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Description</label>
                  <textarea
                    value={serviceForm.description}
                    onChange={(e) => setServiceForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your service..."
                    className="w-full h-20 px-3 py-2 rounded-lg border border-input bg-background/50 backdrop-blur-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Service Image</label>
                  <div className="flex items-center gap-4">
                    {serviceForm.imageUrl ? (
                      <div className="relative w-20 h-20 rounded-lg overflow-hidden">
                        <img src={serviceForm.imageUrl} alt="Service" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setServiceForm(prev => ({ ...prev, imageUrl: '' }))}
                          className="absolute top-1 right-1 p-1 bg-destructive text-white rounded-full"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-20 h-20 rounded-lg border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors">
                        <Upload className="h-5 w-5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground mt-1">Upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                setServiceForm(prev => ({ ...prev, imageUrl: ev.target?.result as string }));
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    )}
                    <p className="text-xs text-muted-foreground flex-1">
                      Upload an image for your service. Recommended size: 400x300px. Max 5MB.
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Category</label>
                  <select
                    value={serviceForm.category}
                    onChange={(e) => setServiceForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Duration (min)</label>
                    <GlassInput
                      type="number"
                      value={serviceForm.duration}
                      onChange={(e) => setServiceForm(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Price ($)</label>
                    <GlassInput
                      type="number"
                      value={serviceForm.price}
                      onChange={(e) => setServiceForm(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <GlassButton variant="ghost" className="flex-1" onClick={() => setShowServiceModal(false)}>
                    Cancel
                  </GlassButton>
                  <GlassButton variant="primary" className="flex-1" onClick={handleSaveService} isLoading={isLoading}>
                    {editingService ? 'Update' : 'Add Service'}
                  </GlassButton>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Staff Modal */}
      <AnimatePresence>
        {showStaffModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setShowStaffModal(false)}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-background/95 border border-border/50 rounded-2xl p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">
                  {editingStaff ? 'Edit Staff Member' : 'Add New Staff'}
                </h2>
                <button onClick={() => setShowStaffModal(false)} className="p-2 hover:bg-muted rounded-lg">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Full Name</label>
                  <GlassInput
                    value={staffForm.name}
                    onChange={(e) => setStaffForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., John Smith"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Role / Title</label>
                  <GlassInput
                    value={staffForm.role}
                    onChange={(e) => setStaffForm(prev => ({ ...prev, role: e.target.value }))}
                    placeholder="e.g., Master Barber"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Bio</label>
                  <textarea
                    value={staffForm.bio}
                    onChange={(e) => setStaffForm(prev => ({ ...prev, bio: e.target.value }))}
                    placeholder="Brief description of experience..."
                    className="w-full h-20 px-3 py-2 rounded-lg border border-input bg-background/50 backdrop-blur-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <GlassButton variant="ghost" className="flex-1" onClick={() => setShowStaffModal(false)}>
                    Cancel
                  </GlassButton>
                  <GlassButton variant="primary" className="flex-1" onClick={handleSaveStaff} isLoading={isLoading}>
                    {editingStaff ? 'Update' : 'Add Staff'}
                  </GlassButton>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Booking Details Modal */}
      <AnimatePresence>
        {showBookingModal && selectedBooking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setShowBookingModal(false)}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-background/95 border border-border/50 rounded-2xl p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Booking Details</h2>
                <button onClick={() => setShowBookingModal(false)} className="p-2 hover:bg-muted rounded-lg">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                  <div className="w-14 h-14 rounded-full gradient-bg flex items-center justify-center text-white font-bold text-lg">
                    {getCustomerInitial(selectedBooking.customerId, selectedBooking)}
                  </div>
                  <div>
                    <div className="font-semibold">{getCustomerName(selectedBooking.customerId, selectedBooking)}</div>
                    <div className="text-sm text-muted-foreground">Customer</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Service</p>
                    <p className="font-medium">{getServiceName(selectedBooking.serviceId, selectedBooking)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Staff</p>
                    <p className="font-medium">{getStaffName(selectedBooking.staffId, selectedBooking)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-medium">{selectedBooking.date}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Time</p>
                    <p className="font-medium">{selectedBooking.startTime} - {selectedBooking.endTime}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className="font-medium text-primary">${selectedBooking.totalAmount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <GlassBadge variant={
                      selectedBooking.status === 'CONFIRMED' ? 'success' :
                      selectedBooking.status === 'PENDING' ? 'warning' :
                      selectedBooking.status === 'IN_PROGRESS' ? 'primary' :
                      selectedBooking.status === 'COMPLETED' ? 'default' : 'destructive'
                    }>
                      {selectedBooking.status}
                    </GlassBadge>
                  </div>
                </div>
                
                {selectedBooking.status !== 'COMPLETED' && selectedBooking.status !== 'CANCELLED' && (
                  <div className="flex gap-2 pt-4 border-t border-border">
                    {selectedBooking.status === 'PENDING' && (
                      <GlassButton 
                        variant="primary" 
                        className="flex-1"
                        onClick={() => handleUpdateBookingStatus(selectedBooking.id, 'CONFIRMED')}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Confirm
                      </GlassButton>
                    )}
                    {selectedBooking.status === 'CONFIRMED' && (
                      <GlassButton 
                        variant="primary" 
                        className="flex-1"
                        onClick={() => handleUpdateBookingStatus(selectedBooking.id, 'IN_PROGRESS')}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Start Service
                      </GlassButton>
                    )}
                    {selectedBooking.status === 'IN_PROGRESS' && (
                      <GlassButton 
                        variant="primary" 
                        className="flex-1"
                        onClick={() => handleUpdateBookingStatus(selectedBooking.id, 'COMPLETED')}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Complete
                      </GlassButton>
                    )}
                    <GlassButton 
                      variant="ghost" 
                      className="flex-1 text-destructive hover:text-destructive"
                      onClick={() => handleUpdateBookingStatus(selectedBooking.id, 'CANCELLED')}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </GlassButton>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image View Modal */}
      <AnimatePresence>
        {showImageModal && selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => {
              setShowImageModal(false);
              setSelectedImage(null);
            }}
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={selectedImage} 
                alt="Preview" 
                className="max-w-full max-h-[90vh] object-contain"
              />
              <button 
                onClick={() => {
                  setShowImageModal(false);
                  setSelectedImage(null);
                }}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default BusinessDashboard;
