'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Filter,
  MessageCircle,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  Upload,
  User,
  X,
  Eye,
  Image as ImageIcon,
  File,
  CalendarClock,
} from 'lucide-react';

import { GlassCard, GlassButton, GlassInput, GlassBadge, GlassModal, FadeIn } from '@/components/ui/custom/glass-components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

type DisputeStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED';
type DisputeType = 'SERVICE_QUALITY' | 'NO_SHOW' | 'PAYMENT_ISSUE' | 'OTHER';
type ResolutionType = 'FULL_REFUND' | 'PARTIAL_REFUND' | 'RESCHEDULE' | 'NO_ACTION';

interface Evidence {
  id: string;
  type: 'photo' | 'document';
  name: string;
  url: string;
  uploadedAt: Date;
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'customer' | 'provider' | 'admin';
  content: string;
  timestamp: Date;
  attachments?: Evidence[];
}

interface BookingDetails {
  id: string;
  serviceName: string;
  businessName: string;
  date: Date;
  time: string;
  price: number;
  status: 'completed' | 'cancelled' | 'pending';
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'customer' | 'provider';
}

interface Dispute {
  id: string;
  bookingId: string;
  bookingDetails: BookingDetails;
  customer: UserInfo;
  provider: UserInfo;
  type: DisputeType;
  description: string;
  evidence: Evidence[];
  status: DisputeStatus;
  messages: Message[];
  resolution?: {
    type: ResolutionType;
    amount?: number;
    notes: string;
    resolvedBy: string;
    resolvedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// API DATA MAPPING
// ============================================

interface ApiDispute {
  id: string;
  bookingId?: string;
  customerId?: string;
  customerName: string;
  providerId?: string;
  providerName: string;
  type: string;
  description: string;
  status: string;
  amount: number;
  resolution?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

const mapApiStatus = (status: string): DisputeStatus => {
  if (status === 'IN_PROGRESS') return 'IN_REVIEW';
  if (status === 'OPEN' || status === 'IN_REVIEW' || status === 'RESOLVED') return status;
  return 'OPEN';
};

const mapApiDispute = (apiDispute: ApiDispute): Dispute => {
  let parsedResolution: Dispute['resolution'] = undefined;
  if (apiDispute.resolution) {
    try {
      const res = JSON.parse(apiDispute.resolution);
      parsedResolution = {
        type: res.type || 'NO_ACTION',
        amount: res.amount,
        notes: res.notes || '',
        resolvedBy: res.resolvedBy || 'Support Team',
        resolvedAt: apiDispute.resolvedAt ? new Date(apiDispute.resolvedAt) : new Date(),
      };
    } catch {
      // If resolution JSON is malformed, ignore it
    }
  }

  return {
    id: apiDispute.id,
    bookingId: apiDispute.bookingId || '',
    bookingDetails: {
      id: apiDispute.bookingId || '',
      serviceName: 'Service',
      businessName: apiDispute.providerName,
      date: new Date(apiDispute.createdAt),
      time: '',
      price: apiDispute.amount,
      status: 'completed',
    },
    customer: {
      id: apiDispute.customerId || '',
      name: apiDispute.customerName,
      email: '',
      role: 'customer',
    },
    provider: {
      id: apiDispute.providerId || '',
      name: apiDispute.providerName,
      email: '',
      role: 'provider',
    },
    type: apiDispute.type as DisputeType,
    description: apiDispute.description,
    evidence: [],
    status: mapApiStatus(apiDispute.status),
    messages: [],
    resolution: parsedResolution,
    createdAt: new Date(apiDispute.createdAt),
    updatedAt: new Date(apiDispute.updatedAt),
  };
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const getStatusBadgeVariant = (status: DisputeStatus): 'warning' | 'primary' | 'success' => {
  switch (status) {
    case 'OPEN':
      return 'warning';
    case 'IN_REVIEW':
      return 'primary';
    case 'RESOLVED':
      return 'success';
    default:
      return 'warning';
  }
};

const getStatusColor = (status: DisputeStatus): string => {
  switch (status) {
    case 'OPEN':
      return 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30';
    case 'IN_REVIEW':
      return 'bg-blue-500/20 text-blue-600 border-blue-500/30';
    case 'RESOLVED':
      return 'bg-green-500/20 text-green-600 border-green-500/30';
    default:
      return 'bg-gray-500/20 text-gray-600 border-gray-500/30';
  }
};

const getDisputeTypeLabel = (type: DisputeType): string => {
  switch (type) {
    case 'SERVICE_QUALITY':
      return 'Service Quality';
    case 'NO_SHOW':
      return 'No-Show';
    case 'PAYMENT_ISSUE':
      return 'Payment Issue';
    case 'OTHER':
      return 'Other';
    default:
      return type;
  }
};

const getResolutionTypeLabel = (type: ResolutionType): string => {
  switch (type) {
    case 'FULL_REFUND':
      return 'Full Refund';
    case 'PARTIAL_REFUND':
      return 'Partial Refund';
    case 'RESCHEDULE':
      return 'Reschedule';
    case 'NO_ACTION':
      return 'No Action Needed';
    default:
      return type;
  }
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ============================================
// STATUS BADGE COMPONENT
// ============================================

interface StatusBadgeProps {
  status: DisputeStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const icons = {
    OPEN: <Clock className="w-3 h-3" />,
    IN_REVIEW: <Eye className="w-3 h-3" />,
    RESOLVED: <CheckCircle2 className="w-3 h-3" />,
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-sm',
        getStatusColor(status)
      )}
    >
      {icons[status]}
      {status.replace('_', ' ')}
    </span>
  );
};

// ============================================
// DISPUTE CREATION FORM
// ============================================

interface DisputeFormProps {
  onSubmit: (data: CreateDisputeData) => void;
  onCancel: () => void;
}

interface CreateDisputeData {
  bookingId: string;
  type: DisputeType;
  description: string;
  evidence: File[];
}

const DisputeCreationForm: React.FC<DisputeFormProps> = ({ onSubmit, onCancel }) => {
  const [bookingId, setBookingId] = useState('');
  const [disputeType, setDisputeType] = useState<DisputeType>('SERVICE_QUALITY');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    onSubmit({
      bookingId,
      type: disputeType,
      description,
      evidence: files,
    });
    
    setIsSubmitting(false);
  };

  return (
    <GlassCard className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Create New Dispute</h2>
            <p className="text-sm text-muted-foreground">Report an issue with your booking</p>
          </div>
        </div>

        {/* Booking Reference */}
        <div className="space-y-2">
          <Label htmlFor="bookingId" className="text-sm font-medium">
            Booking Reference
          </Label>
          <GlassInput
            id="bookingId"
            placeholder="e.g., BK-2024-001"
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            leftIcon={<FileText className="w-4 h-4" />}
            required
          />
        </div>

        {/* Dispute Type */}
        <div className="space-y-2">
          <Label htmlFor="disputeType" className="text-sm font-medium">
            Dispute Type
          </Label>
          <Select value={disputeType} onValueChange={(value: DisputeType) => setDisputeType(value)}>
            <SelectTrigger className="w-full bg-white/50 backdrop-blur-sm border border-input">
              <SelectValue placeholder="Select dispute type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SERVICE_QUALITY">Service Quality</SelectItem>
              <SelectItem value="NO_SHOW">No-Show</SelectItem>
              <SelectItem value="PAYMENT_ISSUE">Payment Issue</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-medium">
            Description
          </Label>
          <Textarea
            id="description"
            placeholder="Please describe the issue in detail..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[120px] bg-white/50 backdrop-blur-sm border border-input rounded-lg resize-none"
            required
          />
        </div>

        {/* Evidence Upload */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Upload Evidence (Optional)</Label>
          <div className="border-2 border-dashed border-input rounded-lg p-6 bg-white/30 backdrop-blur-sm text-center">
            <input
              type="file"
              id="evidence-upload"
              multiple
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="evidence-upload"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="w-6 h-6 text-primary" />
              </div>
              <span className="text-sm font-medium">Click to upload files</span>
              <span className="text-xs text-muted-foreground">
                Photos or documents (PDF, DOC, JPG, PNG)
              </span>
            </label>
          </div>

          {/* Uploaded Files */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-white/40 backdrop-blur-sm rounded-lg border border-input"
                >
                  <div className="flex items-center gap-3">
                    {file.type.startsWith('image/') ? (
                      <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <File className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="p-1 hover:bg-destructive/20 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1 bg-white/50 backdrop-blur-sm"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 gradient-bg text-white"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Dispute'}
          </Button>
        </div>
      </form>
    </GlassCard>
  );
};

// ============================================
// DISPUTE LIST VIEW
// ============================================

interface DisputeListProps {
  disputes: Dispute[];
  onSelectDispute: (dispute: Dispute) => void;
  onCreateNew: () => void;
}

const DisputeListView: React.FC<DisputeListProps> = ({
  disputes,
  onSelectDispute,
  onCreateNew,
}) => {
  const [statusFilter, setStatusFilter] = useState<DisputeStatus | 'ALL'>('ALL');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDisputes = useMemo(() => {
    let result = [...disputes];

    // Filter by status
    if (statusFilter !== 'ALL') {
      result = result.filter(d => d.status === statusFilter);
    }

    // Search by booking ID
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(d => 
        d.bookingId.toLowerCase().includes(query) ||
        d.id.toLowerCase().includes(query)
      );
    }

    // Sort by date
    result.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [disputes, statusFilter, sortOrder, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Dispute Center</h2>
          <p className="text-muted-foreground">Manage and resolve booking disputes</p>
        </div>
        <GlassButton variant="primary" onClick={onCreateNew}>
          <AlertCircle className="w-4 h-4" />
          New Dispute
        </GlassButton>
      </div>

      {/* Filters */}
      <GlassCard className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <GlassInput
              placeholder="Search by booking ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as DisputeStatus | 'ALL')}
            >
              <SelectTrigger className="w-[140px] bg-white/50 backdrop-blur-sm border border-input">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_REVIEW">In Review</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            <Select
              value={sortOrder}
              onValueChange={(value) => setSortOrder(value as 'asc' | 'desc')}
            >
              <SelectTrigger className="w-[140px] bg-white/50 backdrop-blur-sm border border-input">
                <SelectValue placeholder="Sort by date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Newest First</SelectItem>
                <SelectItem value="asc">Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </GlassCard>

      {/* Dispute Cards */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {filteredDisputes.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <GlassCard className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/30 flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No disputes filed</h3>
                <p className="text-muted-foreground">
                  {searchQuery
                    ? 'Try adjusting your search or filters'
                    : 'No disputes filed. Disputes will appear here when a booking issue is reported.'}
                </p>
              </GlassCard>
            </motion.div>
          ) : (
            filteredDisputes.map((dispute, index) => (
              <motion.div
                key={dispute.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
                layout
              >
                <GlassCard
                  className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => onSelectDispute(dispute)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm text-primary">{dispute.id}</span>
                        <StatusBadge status={dispute.status} />
                      </div>
                      <h3 className="font-medium mb-1 truncate">
                        {dispute.bookingDetails.serviceName}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        {dispute.bookingDetails.businessName}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {dispute.bookingId}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(dispute.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {dispute.customer.name}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <GlassBadge variant="default">{getDisputeTypeLabel(dispute.type)}</GlassBadge>
                      <span className="text-lg font-semibold">${dispute.bookingDetails.price}</span>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ============================================
// DISPUTE DETAIL VIEW
// ============================================

interface DisputeDetailProps {
  dispute: Dispute;
  onBack: () => void;
  onResolve: (disputeId: string, resolution: ResolutionData) => void;
  onSendMessage: (disputeId: string, message: string) => void;
}

interface ResolutionData {
  type: ResolutionType;
  amount?: number;
  notes: string;
}

const DisputeDetailView: React.FC<DisputeDetailProps> = ({
  dispute,
  onBack,
  onResolve,
  onSendMessage,
}) => {
  const [newMessage, setNewMessage] = useState('');
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [resolutionType, setResolutionType] = useState<ResolutionType>('FULL_REFUND');
  const [refundAmount, setRefundAmount] = useState(dispute.bookingDetails.price.toString());
  const [resolutionNotes, setResolutionNotes] = useState('');

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      onSendMessage(dispute.id, newMessage.trim());
      setNewMessage('');
    }
  };

  const handleResolve = () => {
    onResolve(dispute.id, {
      type: resolutionType,
      amount: resolutionType === 'PARTIAL_REFUND' ? parseFloat(refundAmount) : undefined,
      notes: resolutionNotes,
    });
    setShowResolutionModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header - No back button since Navbar handles navigation */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold">{dispute.id}</h2>
            <StatusBadge status={dispute.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Created on {formatDate(dispute.createdAt)}
          </p>
        </div>
        {dispute.status !== 'RESOLVED' && (
          <GlassButton variant="primary" onClick={() => setShowResolutionModal(true)}>
            <CheckCircle2 className="w-4 h-4" />
            Resolve
          </GlassButton>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Booking & Parties Info */}
        <div className="space-y-6">
          {/* Booking Details */}
          <GlassCard className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Booking Details
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Booking ID</span>
                <span className="font-mono text-sm">{dispute.bookingId}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Service</span>
                <span className="text-sm font-medium">{dispute.bookingDetails.serviceName}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Business</span>
                <span className="text-sm">{dispute.bookingDetails.businessName}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Date</span>
                <span className="text-sm">{formatDate(dispute.bookingDetails.date)}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Time</span>
                <span className="text-sm">{dispute.bookingDetails.time}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Amount</span>
                <span className="text-lg font-semibold">${dispute.bookingDetails.price}</span>
              </div>
            </div>
          </GlassCard>

          {/* Parties */}
          <GlassCard className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Parties Involved
            </h3>
            <div className="space-y-4">
              {/* Customer */}
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={dispute.customer.avatar} />
                  <AvatarFallback>
                    {dispute.customer.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{dispute.customer.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{dispute.customer.email}</p>
                </div>
                <GlassBadge variant="secondary">Customer</GlassBadge>
              </div>

              <Separator />

              {/* Provider */}
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={dispute.provider.avatar} />
                  <AvatarFallback>
                    {dispute.provider.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{dispute.provider.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{dispute.provider.email}</p>
                </div>
                <GlassBadge variant="default">Provider</GlassBadge>
              </div>
            </div>
          </GlassCard>

          {/* Dispute Info */}
          <GlassCard className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-primary" />
              Dispute Information
            </h3>
            <div className="space-y-3">
              <div>
                <span className="text-muted-foreground text-sm">Type</span>
                <p className="font-medium">{getDisputeTypeLabel(dispute.type)}</p>
              </div>
              <Separator />
              <div>
                <span className="text-muted-foreground text-sm">Description</span>
                <p className="text-sm mt-1">{dispute.description}</p>
              </div>
            </div>
          </GlassCard>

          {/* Evidence */}
          {dispute.evidence.length > 0 && (
            <GlassCard className="p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-primary" />
                Evidence ({dispute.evidence.length})
              </h3>
              <div className="space-y-2">
                {dispute.evidence.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-2 bg-white/30 rounded-lg"
                  >
                    {file.type === 'photo' ? (
                      <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <File className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="text-sm truncate flex-1">{file.name}</span>
                    <Button variant="ghost" size="sm" className="h-7">
                      <Eye className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Resolution (if resolved) */}
          {dispute.resolution && (
            <GlassCard className="p-5 border-green-500/30 bg-green-500/5">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                Resolution
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Resolution Type</span>
                  <span className="font-medium">{getResolutionTypeLabel(dispute.resolution.type)}</span>
                </div>
                {dispute.resolution.amount && (
                  <>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-sm">Refund Amount</span>
                      <span className="font-semibold text-green-600">${dispute.resolution.amount}</span>
                    </div>
                  </>
                )}
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Resolved By</span>
                  <span className="text-sm">{dispute.resolution.resolvedBy}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Resolved On</span>
                  <span className="text-sm">{formatDate(dispute.resolution.resolvedAt)}</span>
                </div>
                {dispute.resolution.notes && (
                  <>
                    <Separator />
                    <div>
                      <span className="text-muted-foreground text-sm">Notes</span>
                      <p className="text-sm mt-1">{dispute.resolution.notes}</p>
                    </div>
                  </>
                )}
              </div>
            </GlassCard>
          )}
        </div>

        {/* Right Column - Message Thread */}
        <div className="lg:col-span-2">
          <GlassCard className="p-5 h-full flex flex-col">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-primary" />
              Message Thread
            </h3>

            {/* Messages */}
            <ScrollArea className="flex-1 pr-4" style={{ maxHeight: '400px' }}>
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {dispute.messages.map((message, index) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        'p-4 rounded-xl',
                        message.senderRole === 'customer'
                          ? 'bg-primary/10 ml-0 mr-8'
                          : message.senderRole === 'admin'
                          ? 'bg-green-500/10 ml-8 mr-0'
                          : 'bg-secondary/30 ml-8 mr-0'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="text-xs">
                            {message.senderName.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">{message.senderName}</span>
                        <GlassBadge
                          variant={
                            message.senderRole === 'admin'
                              ? 'success'
                              : message.senderRole === 'customer'
                              ? 'primary'
                              : 'secondary'
                          }
                          className="text-xs"
                        >
                          {message.senderRole}
                        </GlassBadge>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm">{message.content}</p>
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {message.attachments.map((att) => (
                            <span
                              key={att.id}
                              className="inline-flex items-center gap-1 text-xs bg-white/50 px-2 py-1 rounded"
                            >
                              <Paperclip className="w-3 h-3" />
                              {att.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>

            {/* Message Input */}
            {dispute.status !== 'RESOLVED' && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <div className="flex gap-3">
                  <Textarea
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="min-h-[80px] bg-white/50 backdrop-blur-sm resize-none"
                  />
                  <GlassButton
                    variant="primary"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    className="h-fit self-end"
                  >
                    <Send className="w-4 h-4" />
                  </GlassButton>
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      {/* Resolution Modal */}
      <GlassModal
        isOpen={showResolutionModal}
        onClose={() => setShowResolutionModal(false)}
        title="Resolve Dispute"
        description="Choose a resolution for this dispute"
        size="lg"
      >
        <div className="space-y-6">
          {/* Resolution Type */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Resolution Type</Label>
            <RadioGroup
              value={resolutionType}
              onValueChange={(value) => setResolutionType(value as ResolutionType)}
              className="grid grid-cols-2 gap-3"
            >
              {[
                { value: 'FULL_REFUND', label: 'Full Refund', icon: DollarSign, desc: 'Refund full amount' },
                { value: 'PARTIAL_REFUND', label: 'Partial Refund', icon: CreditCard, desc: 'Refund partial amount' },
                { value: 'RESCHEDULE', label: 'Reschedule', icon: CalendarClock, desc: 'Offer new appointment' },
                { value: 'NO_ACTION', label: 'No Action', icon: CheckCircle2, desc: 'No action needed' },
              ].map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                    'bg-white/30 backdrop-blur-sm',
                    resolutionType === option.value
                      ? 'border-primary bg-primary/5'
                      : 'border-input hover:border-primary/50'
                  )}
                >
                  <RadioGroupItem value={option.value} className="mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <option.icon className="w-4 h-4 text-primary" />
                      <span className="font-medium text-sm">{option.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{option.desc}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Partial Refund Amount */}
          {resolutionType === 'PARTIAL_REFUND' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Refund Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  max={dispute.bookingDetails.price}
                  className="pl-10 bg-white/50 backdrop-blur-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Maximum: ${dispute.bookingDetails.price}
              </p>
            </div>
          )}

          {/* Resolution Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Resolution Notes</Label>
            <Textarea
              placeholder="Add notes about this resolution..."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              className="min-h-[100px] bg-white/50 backdrop-blur-sm resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowResolutionModal(false)}
              className="flex-1 bg-white/50 backdrop-blur-sm"
            >
              Cancel
            </Button>
            <Button onClick={handleResolve} className="flex-1 gradient-bg text-white">
              Confirm Resolution
            </Button>
          </div>
        </div>
      </GlassModal>
    </div>
  );
};

// ============================================
// MAIN DISPUTE CENTER COMPONENT
// ============================================

interface DisputeCenterProps {
  className?: string;
}

export const DisputeCenter: React.FC<DisputeCenterProps> = ({ className }) => {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'detail' | 'create'>('list');
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);

  const fetchDisputes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/disputes');
      if (!response.ok) throw new Error(`Failed to fetch disputes (${response.status})`);
      const data = await response.json();
      const mapped = (data.disputes || []).map(mapApiDispute);
      setDisputes(mapped);
    } catch (err) {
      console.error('Error fetching disputes:', err);
      setError(err instanceof Error ? err.message : 'Failed to load disputes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  const handleSelectDispute = (dispute: Dispute) => {
    setSelectedDispute(dispute);
    setView('detail');
  };

  const handleCreateNew = () => {
    setView('create');
  };

  const handleBack = () => {
    setView('list');
    setSelectedDispute(null);
  };

  const handleCreateDispute = (data: CreateDisputeData) => {
    // In a real app, this would call an API
    const newDispute: Dispute = {
      id: `DSP-${String(disputes.length + 1).padStart(3, '0')}`,
      bookingId: data.bookingId,
      bookingDetails: {
        id: data.bookingId,
        serviceName: 'Service Name',
        businessName: 'Business Name',
        date: new Date(),
        time: '12:00',
        price: 100,
        status: 'completed',
      },
      customer: {
        id: 'usr-current',
        name: 'Current User',
        email: 'user@email.com',
        role: 'customer',
      },
      provider: {
        id: 'pro-001',
        name: 'Business Provider',
        email: 'provider@email.com',
        role: 'provider',
      },
      type: data.type,
      description: data.description,
      evidence: data.evidence.map((file, index) => ({
        id: `ev-new-${index}`,
        type: file.type.startsWith('image/') ? 'photo' : 'document',
        name: file.name,
        url: URL.createObjectURL(file),
        uploadedAt: new Date(),
      })),
      status: 'OPEN',
      messages: [
        {
          id: 'msg-new',
          senderId: 'usr-current',
          senderName: 'Current User',
          senderRole: 'customer',
          content: data.description,
          timestamp: new Date(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setDisputes(prev => [newDispute, ...prev]);
    setView('list');
  };

  const handleResolve = (disputeId: string, resolution: ResolutionData) => {
    setDisputes(prev =>
      prev.map(d =>
        d.id === disputeId
          ? {
              ...d,
              status: 'RESOLVED' as DisputeStatus,
              resolution: {
                type: resolution.type,
                amount: resolution.amount,
                notes: resolution.notes,
                resolvedBy: 'Support Team',
                resolvedAt: new Date(),
              },
              updatedAt: new Date(),
            }
          : d
      )
    );

    // Update selected dispute
    if (selectedDispute?.id === disputeId) {
      setSelectedDispute(prev =>
        prev
          ? {
              ...prev,
              status: 'RESOLVED' as DisputeStatus,
              resolution: {
                type: resolution.type,
                amount: resolution.amount,
                notes: resolution.notes,
                resolvedBy: 'Support Team',
                resolvedAt: new Date(),
              },
              updatedAt: new Date(),
            }
          : null
      );
    }
  };

  const handleSendMessage = (disputeId: string, message: string) => {
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      senderId: 'admin',
      senderName: 'Support Team',
      senderRole: 'admin',
      content: message,
      timestamp: new Date(),
    };

    setDisputes(prev =>
      prev.map(d =>
        d.id === disputeId
          ? {
              ...d,
              messages: [...d.messages, newMessage],
              updatedAt: new Date(),
            }
          : d
      )
    );

    // Update selected dispute
    if (selectedDispute?.id === disputeId) {
      setSelectedDispute(prev =>
        prev
          ? {
              ...prev,
              messages: [...prev.messages, newMessage],
              updatedAt: new Date(),
            }
          : null
      );
    }
  };

  if (isLoading) {
    return (
      <div className={cn('min-h-screen p-4 md:p-6 flex items-center justify-center', className)}>
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
          <p className="text-muted-foreground">Loading disputes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('min-h-screen p-4 md:p-6 flex items-center justify-center', className)}>
        <GlassCard className="p-8 text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-medium mb-2">Failed to Load Disputes</h3>
          <p className="text-muted-foreground mb-6">{error}</p>
          <GlassButton variant="primary" onClick={fetchDisputes}>
            <RefreshCw className="w-4 h-4" />
            Try Again
          </GlassButton>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className={cn('min-h-screen p-4 md:p-6', className)}>
      <div className="max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {view === 'list' && (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <DisputeListView
                disputes={disputes}
                onSelectDispute={handleSelectDispute}
                onCreateNew={handleCreateNew}
              />
            </motion.div>
          )}

          {view === 'detail' && selectedDispute && (
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <DisputeDetailView
                dispute={selectedDispute}
                onBack={handleBack}
                onResolve={handleResolve}
                onSendMessage={handleSendMessage}
              />
            </motion.div>
          )}

          {view === 'create' && (
            <motion.div
              key="create"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-xl mx-auto"
            >
              <DisputeCreationForm
                onSubmit={handleCreateDispute}
                onCancel={handleBack}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default DisputeCenter;
