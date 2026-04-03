'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  parseISO,
  isBefore,
  isAfter,
  setHours,
  setMinutes,
  addMinutes,
  getHours,
  getMinutes,
  isWithinInterval,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Calendar as CalendarIcon,
  X,
  Check,
  AlertCircle,
  Settings,
  Plus,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassCard, GlassButton, GlassBadge, GlassInput, GlassModal } from '@/components/ui/custom/glass-components';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface TimeSlot {
  id: string;
  startTime: Date;
  endTime: Date;
  isBooked: boolean;
  bookingId?: string;
}

export interface Booking {
  id: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  serviceName: string;
  serviceDuration: number; // in minutes
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  notes?: string;
  status: 'confirmed' | 'pending' | 'cancelled';
}

export interface Service {
  id: string;
  name: string;
  duration: number; // in minutes
  price?: number;
  description?: string;
}

export interface DayAvailability {
  date: Date;
  isBlocked: boolean;
  workingHours: {
    start: string; // "09:00"
    end: string;   // "17:00"
  } | null;
}

export interface BlockedDate {
  date: Date;
  reason?: string;
}

export interface BookingCalendarProps {
  services?: Service[];
  bookings?: Booking[];
  blockedDates?: BlockedDate[];
  defaultAvailability?: {
    start: string;
    end: string;
  };
  onSlotSelect?: (slot: TimeSlot, date: Date) => void;
  onBookingCreate?: (booking: Partial<Booking>) => void;
  onDateBlock?: (date: Date, reason?: string) => void;
  onDateUnblock?: (date: Date) => void;
  onAvailabilityChange?: (date: Date, hours: { start: string; end: string }) => void;
  className?: string;
  defaultServiceDuration?: number;
  slotInterval?: number; // minutes between slots
  minAdvanceBooking?: number; // minimum hours in advance
  maxAdvanceBooking?: number; // maximum days in advance
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const generateTimeSlots = (
  date: Date,
  workingHours: { start: string; end: string },
  serviceDuration: number,
  slotInterval: number,
  existingBookings: Booking[],
  minAdvanceHours: number
): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  const [startHour, startMinute] = workingHours.start.split(':').map(Number);
  const [endHour, endMinute] = workingHours.end.split(':').map(Number);

  let currentTime = setMinutes(setHours(date, startHour), startMinute);
  const endTime = setMinutes(setHours(date, endHour), endMinute);
  const now = new Date();
  const minBookingTime = new Date(now.getTime() + minAdvanceHours * 60 * 60 * 1000);

  while (isBefore(currentTime, endTime)) {
    const slotEndTime = addMinutes(currentTime, serviceDuration);

    if (isAfter(slotEndTime, endTime)) break;

    // Check if slot is in the past
    const isPast = isBefore(currentTime, minBookingTime);

    // Check if slot is booked
    const booking = existingBookings.find((b) => {
      const bookingStart = b.startTime;
      const bookingEnd = b.endTime;
      return (
        isSameDay(b.date, date) &&
        ((isWithinInterval(currentTime, { start: bookingStart, end: bookingEnd })) ||
          (isWithinInterval(slotEndTime, { start: bookingStart, end: bookingEnd })) ||
          (isBefore(currentTime, bookingStart) && isAfter(slotEndTime, bookingEnd)))
      );
    });

    slots.push({
      id: `${format(currentTime, 'HH:mm')}-${format(slotEndTime, 'HH:mm')}`,
      startTime: currentTime,
      endTime: slotEndTime,
      isBooked: !!booking,
      bookingId: booking?.id,
    });

    currentTime = addMinutes(currentTime, slotInterval);
  }

  return slots;
};

const getDayAvailability = (
  date: Date,
  blockedDates: BlockedDate[],
  customAvailability: DayAvailability[]
): { isBlocked: boolean; hours: { start: string; end: string } | null } => {
  const blocked = blockedDates.find((bd) => isSameDay(bd.date, date));
  if (blocked) return { isBlocked: true, hours: null };

  const custom = customAvailability.find((ca) => isSameDay(ca.date, date));
  if (custom) return { isBlocked: custom.isBlocked, hours: custom.workingHours };

  return { isBlocked: false, hours: null };
};

// ============================================
// CALENDAR DAY COMPONENT
// ============================================

interface CalendarDayProps {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isBlocked: boolean;
  hasAvailability: boolean;
  hasBookings: boolean;
  onSelect: () => void;
}

const CalendarDay: React.FC<CalendarDayProps> = ({
  date,
  isCurrentMonth,
  isToday,
  isSelected,
  isBlocked,
  hasAvailability,
  hasBookings,
  onSelect,
}) => {
  return (
    <motion.button
      whileHover={!isBlocked && isCurrentMonth ? { scale: 1.05 } : undefined}
      whileTap={!isBlocked && isCurrentMonth ? { scale: 0.95 } : undefined}
      onClick={onSelect}
      disabled={isBlocked || !isCurrentMonth}
      className={cn(
        'relative w-full aspect-square flex flex-col items-center justify-center rounded-xl transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-primary/50',
        isCurrentMonth ? 'cursor-pointer' : 'cursor-default opacity-40',
        isBlocked && 'cursor-not-allowed opacity-50',
        isSelected && 'ring-2 ring-primary bg-primary/10',
        !isSelected && !isBlocked && isCurrentMonth && 'hover:bg-primary/5'
      )}
    >
      {/* Today indicator */}
      {isToday && (
        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
      )}

      {/* Date number */}
      <span
        className={cn(
          'text-sm font-medium',
          isToday && 'text-primary font-semibold',
          isSelected && 'text-primary',
          !isCurrentMonth && 'text-muted-foreground',
          isBlocked && 'text-muted-foreground line-through'
        )}
      >
        {format(date, 'd')}
      </span>

      {/* Status indicators */}
      <div className="flex gap-0.5 mt-1">
        {hasAvailability && !isBlocked && (
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
        )}
        {hasBookings && (
          <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        )}
        {isBlocked && (
          <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
        )}
      </div>
    </motion.button>
  );
};

// ============================================
// TIME SLOT COMPONENT
// ============================================

interface TimeSlotButtonProps {
  slot: TimeSlot;
  isSelected: boolean;
  onSelect: () => void;
  serviceDuration: number;
}

const TimeSlotButton: React.FC<TimeSlotButtonProps> = ({
  slot,
  isSelected,
  onSelect,
  serviceDuration,
}) => {
  const isPast = isBefore(slot.startTime, new Date());

  return (
    <motion.button
      whileHover={!slot.isBooked && !isPast ? { scale: 1.02 } : undefined}
      whileTap={!slot.isBooked && !isPast ? { scale: 0.98 } : undefined}
      onClick={onSelect}
      disabled={slot.isBooked || isPast}
      className={cn(
        'relative w-full py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-primary/50',
        'border border-transparent',
        slot.isBooked && 'bg-gray-200/50 dark:bg-gray-700/50 cursor-not-allowed opacity-60',
        isPast && !slot.isBooked && 'bg-gray-100/50 dark:bg-gray-800/50 cursor-not-allowed opacity-40',
        !slot.isBooked && !isPast && !isSelected && 'bg-green-100/50 dark:bg-green-900/30 hover:bg-green-200/50 dark:hover:bg-green-800/40 hover:border-green-400/50',
        isSelected && 'bg-primary/20 border-primary/50 ring-2 ring-primary/30',
        !slot.isBooked && !isPast && 'text-foreground'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 opacity-60" />
          <span>
            {format(slot.startTime, 'h:mm a')} - {format(slot.endTime, 'h:mm a')}
          </span>
        </div>
        {slot.isBooked ? (
          <GlassBadge variant="secondary" className="text-xs">Booked</GlassBadge>
        ) : isPast ? (
          <GlassBadge variant="default" className="text-xs">Past</GlassBadge>
        ) : (
          <Check className={cn('w-4 h-4', isSelected ? 'text-primary' : 'text-green-600 opacity-0 group-hover:opacity-100')} />
        )}
      </div>
    </motion.button>
  );
};

// ============================================
// BOOKING DETAILS SIDEBAR
// ============================================

interface BookingSidebarProps {
  selectedDate: Date | null;
  selectedSlot: TimeSlot | null;
  selectedService: Service | null;
  services: Service[];
  onServiceChange: (service: Service) => void;
  onConfirm: () => void;
  onClear: () => void;
  existingBooking?: Booking;
}

const BookingSidebar: React.FC<BookingSidebarProps> = ({
  selectedDate,
  selectedSlot,
  selectedService,
  services,
  onServiceChange,
  onConfirm,
  onClear,
  existingBooking,
}) => {
  if (!selectedDate) {
    return (
      <GlassCard className="h-full flex flex-col items-center justify-center text-center p-8">
        <CalendarIcon className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground">Select a Date</h3>
        <p className="text-sm text-muted-foreground/70 mt-2">
          Choose a date from the calendar to view available time slots
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="h-full flex flex-col" variant="bordered">
      <div className="space-y-6">
        {/* Selected Date */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Selected Date</h3>
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-primary" />
            <span className="text-lg font-semibold">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </span>
          </div>
        </div>

        {/* Service Selection */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Service</h3>
          <div className="space-y-2">
            {services.map((service) => (
              <motion.button
                key={service.id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onServiceChange(service)}
                className={cn(
                  'w-full p-3 rounded-xl text-left transition-all duration-200',
                  'border border-transparent',
                  selectedService?.id === service.id
                    ? 'bg-primary/10 border-primary/30'
                    : 'bg-muted/50 hover:bg-muted/70'
                )}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{service.name}</p>
                    <p className="text-sm text-muted-foreground">{service.duration} minutes</p>
                  </div>
                  {service.price && (
                    <span className="text-sm font-semibold">${service.price}</span>
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Selected Time Slot */}
        {selectedSlot && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Selected Time</h3>
            <GlassCard variant="gradient" className="p-4" hover={false}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">
                    {format(selectedSlot.startTime, 'h:mm a')} - {format(selectedSlot.endTime, 'h:mm a')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedService?.duration || 60} minutes
                  </p>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* Existing Booking Info */}
        {existingBooking && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Booking Details</h3>
            <GlassCard className="p-4 bg-secondary/10" hover={false}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{existingBooking.customerName}</p>
                  <p className="text-sm text-muted-foreground">{existingBooking.customerEmail}</p>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Service:</span> {existingBooking.serviceName}</p>
                <p><span className="text-muted-foreground">Status:</span>{' '}
                  <GlassBadge variant={existingBooking.status === 'confirmed' ? 'success' : existingBooking.status === 'pending' ? 'warning' : 'destructive'}>
                    {existingBooking.status}
                  </GlassBadge>
                </p>
                {existingBooking.notes && (
                  <p><span className="text-muted-foreground">Notes:</span> {existingBooking.notes}</p>
                )}
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-auto pt-4">
          <GlassButton
            variant="ghost"
            onClick={onClear}
            className="flex-1"
          >
            Clear
          </GlassButton>
          <GlassButton
            variant="primary"
            onClick={onConfirm}
            disabled={!selectedSlot || !selectedService}
            className="flex-1"
          >
            Confirm Booking
          </GlassButton>
        </div>
      </div>
    </GlassCard>
  );
};

// ============================================
// AVAILABILITY SETTINGS MODAL
// ============================================

interface AvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  isBlocked: boolean;
  currentHours: { start: string; end: string } | null;
  defaultHours: { start: string; end: string };
  onBlockDate: (reason?: string) => void;
  onUnblockDate: () => void;
  onUpdateHours: (hours: { start: string; end: string }) => void;
}

const AvailabilityModal: React.FC<AvailabilityModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  isBlocked,
  currentHours,
  defaultHours,
  onBlockDate,
  onUnblockDate,
  onUpdateHours,
}) => {
  const [hours, setHours] = useState(currentHours || defaultHours);
  const [blockReason, setBlockReason] = useState('');

  React.useEffect(() => {
    setHours(currentHours || defaultHours);
  }, [currentHours, defaultHours]);

  if (!selectedDate) return null;

  return (
    <GlassModal isOpen={isOpen} onClose={onClose} title="Availability Settings" size="md">
      <div className="space-y-6">
        {/* Date Display */}
        <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-xl">
          <CalendarIcon className="w-6 h-6 text-primary" />
          <div>
            <p className="font-semibold">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
            <p className="text-sm text-muted-foreground">
              {isBlocked ? 'Currently blocked' : 'Currently available'}
            </p>
          </div>
        </div>

        {/* Working Hours */}
        {!isBlocked && (
          <div>
            <h4 className="text-sm font-medium mb-3">Working Hours</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Start Time</label>
                <GlassInput
                  type="time"
                  value={hours.start}
                  onChange={(e) => setHours((prev) => ({ ...prev, start: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">End Time</label>
                <GlassInput
                  type="time"
                  value={hours.end}
                  onChange={(e) => setHours((prev) => ({ ...prev, end: e.target.value }))}
                />
              </div>
            </div>
            <GlassButton
              variant="outline"
              className="w-full mt-3"
              onClick={() => onUpdateHours(hours)}
            >
              <Check className="w-4 h-4" />
              Update Hours
            </GlassButton>
          </div>
        )}

        {/* Block/Unblock */}
        <div className="border-t pt-6">
          {isBlocked ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">This date is currently blocked for bookings.</p>
              <GlassButton variant="primary" onClick={onUnblockDate} className="w-full">
                <Check className="w-4 h-4" />
                Unblock Date
              </GlassButton>
            </div>
          ) : (
            <div className="space-y-3">
              <GlassInput
                placeholder="Reason for blocking (optional)"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
              <GlassButton
                variant="outline"
                onClick={() => onBlockDate(blockReason || undefined)}
                className="w-full text-red-500 border-red-500 hover:bg-red-500/10"
              >
                <AlertCircle className="w-4 h-4" />
                Block This Date
              </GlassButton>
            </div>
          )}
        </div>
      </div>
    </GlassModal>
  );
};

// ============================================
// MAIN BOOKING CALENDAR COMPONENT
// ============================================

export const BookingCalendar: React.FC<BookingCalendarProps> = ({
  services = [
    { id: '1', name: 'Haircut', duration: 30, price: 25 },
    { id: '2', name: 'Hair Color', duration: 90, price: 75 },
    { id: '3', name: 'Beard Trim', duration: 15, price: 10 },
  ],
  bookings = [],
  blockedDates = [],
  defaultAvailability = { start: '09:00', end: '17:00' },
  onSlotSelect,
  onBookingCreate,
  onDateBlock,
  onDateUnblock,
  onAvailabilityChange,
  className,
  defaultServiceDuration = 60,
  slotInterval = 30,
  minAdvanceBooking = 2,
  maxAdvanceBooking = 90,
}) => {
  // State
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(services[0] || null);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [customAvailability, setCustomAvailability] = useState<DayAvailability[]>([]);

  // Get days in current month view
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Get bookings for selected date
  const bookingsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return bookings.filter((b) => isSameDay(b.date, selectedDate));
  }, [selectedDate, bookings]);

  // Generate time slots for selected date
  const timeSlots = useMemo(() => {
    if (!selectedDate) return [];

    const dayAvailability = getDayAvailability(selectedDate, blockedDates, customAvailability);
    if (dayAvailability.isBlocked) return [];

    const workingHours = dayAvailability.hours || defaultAvailability;

    return generateTimeSlots(
      selectedDate,
      workingHours,
      selectedService?.duration || defaultServiceDuration,
      slotInterval,
      bookingsForSelectedDate,
      minAdvanceBooking
    );
  }, [
    selectedDate,
    blockedDates,
    customAvailability,
    defaultAvailability,
    selectedService,
    defaultServiceDuration,
    slotInterval,
    bookingsForSelectedDate,
    minAdvanceBooking,
  ]);

  // Get existing booking for selected slot
  const existingBooking = useMemo(() => {
    if (!selectedSlot || !selectedSlot.bookingId) return undefined;
    return bookings.find((b) => b.id === selectedSlot.bookingId);
  }, [selectedSlot, bookings]);

  // Check if selected date is blocked
  const isSelectedDateBlocked = useMemo(() => {
    if (!selectedDate) return false;
    return blockedDates.some((bd) => isSameDay(bd.date, selectedDate));
  }, [selectedDate, blockedDates]);

  // Get current hours for selected date
  const currentHoursForSelectedDate = useMemo(() => {
    if (!selectedDate) return null;
    const custom = customAvailability.find((ca) => isSameDay(ca.date, selectedDate));
    return custom?.workingHours || null;
  }, [selectedDate, customAvailability]);

  // Handlers
  const handlePrevMonth = () => setCurrentMonth((prev) => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentMonth((prev) => addMonths(prev, 1));

  const handleDateSelect = (date: Date) => {
    const dayAvailability = getDayAvailability(date, blockedDates, customAvailability);
    if (dayAvailability.isBlocked) return;

    setSelectedDate(date);
    setSelectedSlot(null);
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    if (slot.isBooked || isBefore(slot.startTime, new Date())) return;
    setSelectedSlot(slot);
    onSlotSelect?.(slot, selectedDate!);
  };

  const handleConfirmBooking = () => {
    if (!selectedSlot || !selectedDate || !selectedService) return;

    onBookingCreate?.({
      date: selectedDate,
      startTime: selectedSlot.startTime,
      endTime: selectedSlot.endTime,
      serviceName: selectedService.name,
      serviceDuration: selectedService.duration,
      status: 'pending',
    });
  };

  const handleClearSelection = () => {
    setSelectedSlot(null);
    setSelectedService(services[0] || null);
  };

  const handleBlockDate = (reason?: string) => {
    if (!selectedDate) return;
    onDateBlock?.(selectedDate, reason);
    setShowAvailabilityModal(false);
  };

  const handleUnblockDate = () => {
    if (!selectedDate) return;
    onDateUnblock?.(selectedDate);
    setShowAvailabilityModal(false);
  };

  const handleUpdateHours = (hours: { start: string; end: string }) => {
    if (!selectedDate) return;
    setCustomAvailability((prev) => {
      const existing = prev.findIndex((ca) => isSameDay(ca.date, selectedDate));
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], workingHours: hours };
        return updated;
      }
      return [...prev, { date: selectedDate, isBlocked: false, workingHours: hours }];
    });
    onAvailabilityChange?.(selectedDate, hours);
    setShowAvailabilityModal(false);
  };

  // Check if day has bookings
  const dayHasBookings = useCallback(
    (date: Date) => bookings.some((b) => isSameDay(b.date, date)),
    [bookings]
  );

  // Check if day has availability
  const dayHasAvailability = useCallback(
    (date: Date) => {
      const dayAvailability = getDayAvailability(date, blockedDates, customAvailability);
      return !dayAvailability.isBlocked;
    },
    [blockedDates, customAvailability]
  );

  // Check if day is blocked
  const dayIsBlocked = useCallback(
    (date: Date) => blockedDates.some((bd) => isSameDay(bd.date, date)),
    [blockedDates]
  );

  // Check if date is within booking window
  const isWithinBookingWindow = useCallback(
    (date: Date) => {
      const now = new Date();
      const maxDate = new Date(now.getTime() + maxAdvanceBooking * 24 * 60 * 60 * 1000);
      return !isBefore(date, now) && !isAfter(date, maxDate);
    },
    [maxAdvanceBooking]
  );

  return (
    <div className={cn('grid grid-cols-1 lg:grid-cols-3 gap-6', className)}>
      {/* Calendar Section */}
      <div className="lg:col-span-2">
        <GlassCard variant="bordered" className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <div className="flex items-center gap-2">
              {selectedDate && (
                <GlassButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAvailabilityModal(true)}
                  leftIcon={<Settings className="w-4 h-4" />}
                >
                  Settings
                </GlassButton>
              )}
              <div className="flex gap-1">
                <GlassButton
                  variant="ghost"
                  size="icon"
                  onClick={handlePrevMonth}
                >
                  <ChevronLeft className="w-5 h-5" />
                </GlassButton>
                <GlassButton
                  variant="ghost"
                  size="icon"
                  onClick={handleNextMonth}
                >
                  <ChevronRight className="w-5 h-5" />
                </GlassButton>
              </div>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="space-y-4">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-medium text-muted-foreground py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentMonth.toISOString()}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-7 gap-2"
              >
                {days.map((day) => {
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                  const dayBlocked = dayIsBlocked(day);
                  const hasAvail = dayHasAvailability(day) && isWithinBookingWindow(day);
                  const hasBookings = dayHasBookings(day);

                  return (
                    <CalendarDay
                      key={day.toISOString()}
                      date={day}
                      isCurrentMonth={isCurrentMonth}
                      isToday={isToday(day)}
                      isSelected={isSelected}
                      isBlocked={dayBlocked || !isWithinBookingWindow(day)}
                      hasAvailability={hasAvail}
                      hasBookings={hasBookings}
                      onSelect={() => handleDateSelect(day)}
                    />
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-border/50">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-muted-foreground">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gray-400" />
              <span className="text-xs text-muted-foreground">Booked</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-xs text-muted-foreground">Blocked</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-xs text-muted-foreground">Today</span>
            </div>
          </div>
        </GlassCard>

        {/* Time Slots Section */}
        {selectedDate && !isSelectedDateBlocked && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6"
          >
            <GlassCard variant="bordered" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Available Time Slots</h3>
                <GlassBadge variant="primary">
                  {selectedService?.duration || defaultServiceDuration} min slots
                </GlassBadge>
              </div>

              {timeSlots.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                  {timeSlots.map((slot) => (
                    <TimeSlotButton
                      key={slot.id}
                      slot={slot}
                      isSelected={selectedSlot?.id === slot.id}
                      onSelect={() => handleSlotSelect(slot)}
                      serviceDuration={selectedService?.duration || defaultServiceDuration}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="w-12 h-12 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">No available time slots</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    All slots may be booked or outside working hours
                  </p>
                </div>
              )}
            </GlassCard>
          </motion.div>
        )}

        {/* Blocked Date Message */}
        {selectedDate && isSelectedDateBlocked && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6"
          >
            <GlassCard className="p-6 bg-red-500/10 border-red-500/30" hover={false}>
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-red-500" />
                <div>
                  <p className="font-medium text-red-600 dark:text-red-400">This date is blocked</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This date has been marked as unavailable for bookings.
                  </p>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </div>

      {/* Sidebar */}
      <div className="lg:col-span-1">
        <BookingSidebar
          selectedDate={selectedDate}
          selectedSlot={selectedSlot}
          selectedService={selectedService}
          services={services}
          onServiceChange={setSelectedService}
          onConfirm={handleConfirmBooking}
          onClear={handleClearSelection}
          existingBooking={existingBooking}
        />
      </div>

      {/* Availability Settings Modal */}
      <AvailabilityModal
        isOpen={showAvailabilityModal}
        onClose={() => setShowAvailabilityModal(false)}
        selectedDate={selectedDate}
        isBlocked={isSelectedDateBlocked}
        currentHours={currentHoursForSelectedDate}
        defaultHours={defaultAvailability}
        onBlockDate={handleBlockDate}
        onUnblockDate={handleUnblockDate}
        onUpdateHours={handleUpdateHours}
      />
    </div>
  );
};

export default BookingCalendar;
