'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  User, 
  CreditCard,
  Check,
  Calendar,
  AlertCircle,
  Loader2,
  Shield,
  Lock,
} from 'lucide-react';
import { 
  GlassCard, 
  GlassButton, 
  GlassBadge,
  FadeIn,
} from '@/components/ui/custom/glass-components';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/store';
import type { Business, Service, Staff } from '@/types';

interface BookingPageProps {
  business: Business;
  selectedService?: Service | null;
  onBack?: () => void;
  onComplete?: () => void;
}

type BookingStep = 'service' | 'staff' | 'datetime' | 'confirm' | 'payment' | 'success';

const calculateEndTime = (startTime: string, durationMinutes: number): string => {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
};

export const BookingPage: React.FC<BookingPageProps> = ({
  business,
  selectedService: initialService,
  onBack,
  onComplete,
}) => {
  const { isAuthenticated, user } = useAuthStore();

  // RBAC: Block admin and provider-mode users at UI level
  const isAdmin = user?.roles?.includes('ADMIN');
  const isProviderMode = user?.activeMode === 'PROVIDER';

  const [step, setStep] = useState<BookingStep>(initialService ? 'staff' : 'service');
  const [selectedService, setSelectedService] = useState<Service | null>(initialService || null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'paypal' | 'mpesa'>('card');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingId, setBookingId] = useState<string>('');

  // UI-level RBAC guard — defense in depth (page.tsx also guards, but this catches direct renders)
  if (isAdmin) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen py-8"
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-6">
              <Shield className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Admin accounts cannot book services. This action is restricted to customer accounts in Client mode.
            </p>
            <GlassButton variant="default" onClick={onBack}>
              Go Back
            </GlassButton>
          </div>
        </div>
      </motion.div>
    );
  }

  if (isProviderMode) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen py-8"
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-6">
              <Lock className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Switch to Client Mode</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              You are currently in Provider mode. Switch to Client mode to book services for yourself.
            </p>
            <GlassButton variant="default" onClick={onBack}>
              Go Back
            </GlassButton>
          </div>
        </div>
      </motion.div>
    );
  }

  const steps: { id: BookingStep; label: string }[] = [
    { id: 'service', label: 'Service' },
    { id: 'staff', label: 'Professional' },
    { id: 'datetime', label: 'Date & Time' },
    { id: 'confirm', label: 'Confirm' },
    { id: 'payment', label: 'Payment' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === step);

  // Generate time slots
  const generateTimeSlots = () => {
    const slots: string[] = [];
    for (let hour = 9; hour <= 18; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  // Generate dates starting from tomorrow (no past dates)
  const generateDates = () => {
    const dates: string[] = [];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    for (let i = 0; i < 14; i++) {
      const date = new Date(tomorrow);
      date.setDate(tomorrow.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    // Auto-select the first available date if none selected
    if (!selectedDate && dates.length > 0) {
      setSelectedDate(dates[0]);
    }
    return dates;
  };

  const availableDates = generateDates();

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const handleNext = async () => {
    if (step === 'payment') {
      // Authentication check
      if (!isAuthenticated) {
        setBookingError('Please sign in to make a booking.');
        return;
      }

      setIsSubmitting(true);
      setBookingError('');

      try {
        const endTime = selectedService
          ? calculateEndTime(selectedTime, selectedService.duration)
          : selectedTime;

        const bookingData = {
          businessId: business.id,
          serviceId: selectedService!.id,
          staffId: selectedStaff && selectedStaff.id !== 'any' ? selectedStaff.id : null,
          date: selectedDate,
          startTime: selectedTime,
          endTime,
          notes: notes.trim() || undefined,
        };

        const response = await api.createBooking(bookingData);

        if (response.data && typeof response.data === 'object' && 'id' in response.data) {
          setBookingId((response.data as { id: string }).id);
          setStep('success');
          setTimeout(() => onComplete?.(), 2000);
        } else {
          setBookingError('Booking created but could not retrieve confirmation ID.');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create booking. Please try again.';
        setBookingError(message);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex].id);
      setBookingError('');
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex].id);
      setBookingError('');
    } else {
      onBack?.();
    }
  };

  const canProceed = () => {
    switch (step) {
      case 'service':
        return selectedService !== null;
      case 'staff':
        return selectedStaff !== null;
      case 'datetime':
        return selectedDate && selectedTime;
      case 'confirm':
        return true;
      case 'payment':
        return paymentMethod;
      default:
        return false;
    }
  };

  const totalPrice = selectedService?.discountPrice || selectedService?.price || 0;

  // Format the booking ID for display (first 8 chars)
  const displayBookingId = bookingId
    ? `STY-${bookingId.substring(0, 8).toUpperCase()}`
    : '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen py-8"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <FadeIn>
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={handleBack}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">Book Appointment</h1>
              <p className="text-muted-foreground">{business.name}</p>
            </div>
          </div>
        </FadeIn>

        {/* Progress Steps */}
        {step !== 'success' && (
          <FadeIn delay={0.1}>
            <div className="flex items-center justify-between mb-8">
              {steps.map((s, index) => (
                <div key={s.id} className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                      index <= currentStepIndex
                        ? 'gradient-bg text-white'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {index < currentStepIndex ? <Check className="h-4 w-4" /> : index + 1}
                  </div>
                  <span
                    className={`hidden sm:block ml-2 text-sm ${
                      index <= currentStepIndex ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {s.label}
                  </span>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-8 sm:w-16 h-0.5 mx-2 ${
                        index < currentStepIndex ? 'bg-primary' : 'bg-muted'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </FadeIn>
        )}

        {/* Error Banner */}
        {bookingError && (
          <FadeIn>
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-red-800">Booking Error</div>
                <div className="text-sm text-red-600 mt-0.5">{bookingError}</div>
              </div>
              <button
                onClick={() => setBookingError('')}
                className="ml-auto text-red-400 hover:text-red-600 transition-colors"
              >
                &times;
              </button>
            </div>
          </FadeIn>
        )}

        {/* Step Content */}
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Service Selection */}
          {step === 'service' && (
            <GlassCard variant="default" className="p-6">
              <h2 className="text-lg font-semibold mb-4">Select a Service</h2>
              <div className="space-y-3">
                {business.services?.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => setSelectedService(service)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      selectedService?.id === service.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{service.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {service.description}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-sm">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {service.duration} min
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg text-primary">
                          ${service.discountPrice || service.price}
                        </div>
                        {service.discountPrice && (
                          <div className="text-sm text-muted-foreground line-through">
                            ${service.price}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Staff Selection */}
          {step === 'staff' && (
            <GlassCard variant="default" className="p-6">
              <h2 className="text-lg font-semibold mb-4">Choose a Professional</h2>
              <div className="grid grid-cols-2 gap-4">
                {business.staff?.map((staff) => (
                  <button
                    key={staff.id}
                    onClick={() => setSelectedStaff(staff)}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      selectedStaff?.id === staff.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="w-16 h-16 rounded-full mx-auto bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-3 overflow-hidden">
                      {staff.avatar ? (
                        <img src={staff.avatar} alt={staff.name} className="w-full h-full object-cover" />
                      ) : (
                        <User className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="font-medium">{staff.name}</div>
                    <div className="text-sm text-muted-foreground">{staff.role}</div>
                  </button>
                ))}
                {/* Any Available Option */}
                <button
                  onClick={() => setSelectedStaff({ id: 'any', businessId: business.id, name: 'Any Available', role: 'First Available', isActive: true, createdAt: new Date(), updatedAt: new Date() })}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${
                    selectedStaff?.id === 'any'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="w-16 h-16 rounded-full mx-auto bg-muted flex items-center justify-center mb-3">
                    <User className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="font-medium">Any Available</div>
                  <div className="text-sm text-muted-foreground">First available</div>
                </button>
              </div>
            </GlassCard>
          )}

          {/* Date & Time Selection */}
          {step === 'datetime' && (
            <div className="space-y-6">
              <GlassCard variant="default" className="p-6">
                <h2 className="text-lg font-semibold mb-4">Select Date</h2>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {availableDates.map((date) => (
                    <button
                      key={date}
                      onClick={() => setSelectedDate(date)}
                      className={`flex-shrink-0 p-3 rounded-xl text-center transition-all ${
                        selectedDate === date
                          ? 'gradient-bg text-white'
                          : 'bg-muted/50 hover:bg-muted'
                      }`}
                    >
                      <div className="text-xs uppercase">
                        {new Date(date).toLocaleDateString('en-KE', { weekday: 'short' })}
                      </div>
                      <div className="text-lg font-bold">
                        {new Date(date).getDate()}
                      </div>
                    </button>
                  ))}
                </div>
              </GlassCard>

              <GlassCard variant="default" className="p-6">
                <h2 className="text-lg font-semibold mb-4">Select Time</h2>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {timeSlots.map((time) => (
                    <button
                      key={time}
                      onClick={() => setSelectedTime(time)}
                      className={`p-2 rounded-lg text-sm transition-all ${
                        selectedTime === time
                          ? 'gradient-bg text-white'
                          : 'bg-muted/50 hover:bg-muted'
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </GlassCard>

              <GlassCard variant="default" className="p-6">
                <h2 className="text-lg font-semibold mb-4">Add Notes (Optional)</h2>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special requests or notes..."
                  className="w-full h-24 p-3 rounded-lg border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </GlassCard>
            </div>
          )}

          {/* Confirmation */}
          {step === 'confirm' && (
            <GlassCard variant="default" className="p-6">
              <h2 className="text-lg font-semibold mb-4">Confirm Your Booking</h2>
              
              <div className="space-y-4">
                <div className="flex justify-between py-3 border-b border-border">
                  <span className="text-muted-foreground">Service</span>
                  <span className="font-medium">{selectedService?.name}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-border">
                  <span className="text-muted-foreground">Professional</span>
                  <span className="font-medium">{selectedStaff?.name}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-border">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{formatDate(selectedDate)}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-border">
                  <span className="text-muted-foreground">Time</span>
                  <span className="font-medium">{selectedTime}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-border">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">{selectedService?.duration} minutes</span>
                </div>
                <div className="flex justify-between py-3">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-xl gradient-text">${totalPrice}</span>
                </div>
              </div>

              {notes && (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Notes:</div>
                  <div className="text-sm">{notes}</div>
                </div>
              )}
            </GlassCard>
          )}

          {/* Payment */}
          {step === 'payment' && (
            <GlassCard variant="default" className="p-6">
              <h2 className="text-lg font-semibold mb-4">Payment Method</h2>
              
              <div className="space-y-3">
                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                    paymentMethod === 'card' ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="w-12 h-8 rounded bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                    CARD
                  </div>
                  <div>
                    <div className="font-medium">Credit / Debit Card</div>
                    <div className="text-sm text-muted-foreground">Visa, Mastercard, etc.</div>
                  </div>
                </button>

                <button
                  onClick={() => setPaymentMethod('paypal')}
                  className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                    paymentMethod === 'paypal' ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="w-12 h-8 rounded bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                    PayPal
                  </div>
                  <div>
                    <div className="font-medium">PayPal</div>
                    <div className="text-sm text-muted-foreground">Pay with PayPal account</div>
                  </div>
                </button>

                <button
                  onClick={() => setPaymentMethod('mpesa')}
                  className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                    paymentMethod === 'mpesa' ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="w-12 h-8 rounded bg-green-600 flex items-center justify-center text-white text-xs font-bold">
                    M-Pesa
                  </div>
                  <div>
                    <div className="font-medium">M-Pesa</div>
                    <div className="text-sm text-muted-foreground">Mobile money payment</div>
                  </div>
                </button>
              </div>

              <div className="mt-6 p-4 bg-muted/50 rounded-lg flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  Your payment is secured with industry-standard encryption. 
                  You will not be charged until the service is completed.
                </div>
              </div>
            </GlassCard>
          )}

          {/* Success */}
          {step === 'success' && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-16"
            >
              <div className="w-20 h-20 rounded-full gradient-bg flex items-center justify-center mx-auto mb-6">
                <Check className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Booking Confirmed!</h2>
              <p className="text-muted-foreground mb-6">
                Your appointment has been scheduled successfully.
              </p>
              <GlassCard variant="default" className="p-6 text-left max-w-sm mx-auto">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Confirmation #</span>
                    <span className="font-mono font-medium">{displayBookingId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Service</span>
                    <span className="font-medium">{selectedService?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date & Time</span>
                    <span className="font-medium">{formatDate(selectedDate)} at {selectedTime}</span>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </motion.div>

        {/* Navigation Buttons */}
        {step !== 'success' && (
          <div className="flex gap-4 mt-8">
            <GlassButton
              variant="default"
              size="lg"
              onClick={handleBack}
              disabled={isSubmitting}
              className="flex-1"
            >
              Back
            </GlassButton>
            <GlassButton
              variant="primary"
              size="lg"
              onClick={handleNext}
              disabled={!canProceed() || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </span>
              ) : step === 'payment' ? (
                <span className="flex items-center justify-center gap-1">
                  Complete Booking
                  <ChevronRight className="h-4 w-4" />
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1">
                  Continue
                  <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </GlassButton>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default BookingPage;
