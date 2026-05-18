'use client';

import React from 'react';
import { Skeleton, GlassCard, GlassBadge } from '@/components/ui/custom/glass-components';

// ============================================
// BUSINESS CARD SKELETON
// Exact same structure as BusinessCard:
// <GlassCard variant="default" hover className="cursor-pointer overflow-hidden p-0">
//   <div className="relative h-40 sm:h-48 bg-gradient-to-br from-primary/20 to-secondary/20 overflow-hidden">
//     <img> + gradient overlay + badges + favorite + rating
//   </div>
//   <div className="p-3 sm:p-4">
//     h3 + description + location/services row + service tags
//   </div>
// </GlassCard>
// ============================================

interface BusinessCardSkeletonProps {
  compact?: boolean;
}

export const BusinessCardSkeleton: React.FC<BusinessCardSkeletonProps> = ({ compact = false }) => {
  return (
    <GlassCard variant="default" hover={false} className="overflow-hidden p-0">
      {/* Image — exact same as BusinessCard */}
      <div className="relative h-40 sm:h-48 bg-gradient-to-br from-primary/20 to-secondary/20 overflow-hidden">
        <Skeleton className="absolute inset-0 rounded-none" variant="rectangular" />
        {/* Gradient overlay — same as real */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        {/* Badges — same position as GlassBadge */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <Skeleton className="h-6 w-[72px] rounded-full" />
          <Skeleton className="h-6 w-[62px] rounded-full" />
        </div>
        {/* Favorite button — same position/size as real */}
        <Skeleton className="absolute top-3 right-3 h-11 w-11 rounded-xl" variant="rectangular" />
        {/* Rating badge — same position as real with glass style */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 rounded-lg glass">
          <Skeleton className="h-4 w-5 rounded-sm" variant="rectangular" />
          <Skeleton className="h-4 w-8 rounded-sm" variant="rectangular" />
        </div>
      </div>

      {/* Content — exact same padding as BusinessCard */}
      <div className="p-3 sm:p-4">
        {/* Title — matches h3 font-semibold text-base sm:text-lg mb-1 line-clamp-1 */}
        <Skeleton className="h-6 w-3/4 mb-1" variant="text" />
        {/* Description — matches text-sm mb-2 sm:mb-3 line-clamp-2 */}
        {!compact && <Skeleton className="h-4 w-full mb-1" variant="text" />}
        {!compact && <Skeleton className="h-4 w-2/3 mb-3" variant="text" />}

        {/* Location & services — matches flex items-center gap-2 sm:gap-4 text-sm */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-1 min-w-0">
            <Skeleton className="h-4 w-4 rounded-sm flex-shrink-0" variant="rectangular" />
            <Skeleton className="h-4 w-16" variant="text" />
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Skeleton className="h-4 w-4 rounded-sm flex-shrink-0" variant="rectangular" />
            <Skeleton className="h-4 w-20" variant="text" />
          </div>
        </div>

        {/* Service tags — matches mt-3 flex flex-wrap gap-1 */}
        {!compact && (
          <div className="mt-3 flex flex-wrap gap-1">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
        )}
      </div>
    </GlassCard>
  );
};

// ============================================
// BUSINESS PROFILE SKELETON
// Exact same structure as BusinessProfilePage
// ============================================

export const BusinessProfileSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen pb-24">
      {/* Cover Image — exact same as BusinessProfilePage */}
      <div className="relative h-48 sm:h-64 md:h-80 bg-gradient-to-br from-primary/20 to-secondary/20 overflow-hidden">
        <Skeleton className="absolute inset-0 rounded-none" variant="rectangular" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        {/* Back button — desktop only, exact same style */}
        <Skeleton className="hidden md:flex absolute top-4 left-4 z-10 h-11 w-11 rounded-xl" variant="rectangular" />
        {/* Action buttons — same position/right */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <Skeleton className="h-11 w-11 rounded-xl" variant="rectangular" />
          <Skeleton className="h-11 w-11 rounded-xl" variant="rectangular" />
        </div>
        {/* Badges — same position */}
        <div className="absolute bottom-4 left-4 flex gap-2">
          <Skeleton className="h-6 w-[72px] rounded-full" />
          <Skeleton className="h-6 w-[80px] rounded-full" />
          <Skeleton className="h-6 w-[80px] rounded-full" />
        </div>
      </div>

      {/* Header Card — exact same wrapper */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-10">
        <GlassCard variant="elevated" hover={false} className="p-4 sm:p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Logo — matches w-16 h-16 sm:w-24 sm:h-24 rounded-xl */}
            <Skeleton className="w-16 h-16 sm:w-24 sm:h-24 rounded-xl flex-shrink-0" variant="rectangular" />

            {/* Info — same flex-1 min-w-0 structure */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                  {/* Name — matches text-xl sm:text-2xl font-bold mb-2 */}
                  <Skeleton className="h-7 w-48 mb-2" variant="text" />
                  {/* Category + Location + Rating — matches flex-wrap gap-x-4 gap-y-1 */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm sm:text-base">
                    <div className="flex items-center gap-1">
                      <Skeleton className="h-4 w-4 rounded-sm" variant="rectangular" />
                      <Skeleton className="h-5 w-24" variant="text" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Skeleton className="h-4 w-4 rounded-sm" variant="rectangular" />
                      <Skeleton className="h-5 w-32" variant="text" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Skeleton className="h-4 w-4 rounded-sm" variant="rectangular" />
                      <Skeleton className="h-5 w-28" variant="text" />
                    </div>
                  </div>
                </div>
                {/* Buttons — matches flex-wrap gap-2 sm:gap-3 */}
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  <Skeleton className="h-11 w-28 rounded-xl" variant="rectangular" />
                  <Skeleton className="h-11 w-28 rounded-xl" variant="rectangular" />
                </div>
              </div>
              {/* Quick info — matches flex-wrap gap-x-6 gap-y-2 mt-4 pt-4 border-t */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-sm" variant="rectangular" />
                  <Skeleton className="h-4 w-24" variant="text" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-sm" variant="rectangular" />
                  <Skeleton className="h-4 w-28" variant="text" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-sm" variant="rectangular" />
                  <Skeleton className="h-4 w-20" variant="text" />
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Tabs — matches flex gap-2 mb-6 overflow-x-auto pb-2 */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <Skeleton className="h-10 w-28 rounded-lg flex-shrink-0" variant="rectangular" />
          <Skeleton className="h-10 w-24 rounded-lg flex-shrink-0" variant="rectangular" />
          <Skeleton className="h-10 w-24 rounded-lg flex-shrink-0" variant="rectangular" />
          <Skeleton className="h-10 w-20 rounded-lg flex-shrink-0" variant="rectangular" />
        </div>

        {/* Services Grid — matches grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <ServiceCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================
// SERVICE CARD SKELETON
// Exact same structure as service cards in BusinessProfilePage
// <GlassCard variant="default" hover className="cursor-pointer p-0...no wait">
// Actually: <GlassCard variant="default" hover className="cursor-pointer ...">
// Inside: flex flex-col sm:flex-row gap-3 sm:gap-4
//   - w-16 h-16 rounded-lg icon
//   - flex-1: name, description, price/discount/duration
// ============================================

export const ServiceCardSkeleton: React.FC = () => {
  return (
    <GlassCard variant="default" hover={false} className="p-6">
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        {/* Icon — matches w-16 h-16 rounded-lg */}
        <Skeleton className="w-16 h-16 rounded-lg flex-shrink-0" variant="rectangular" />
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Name — matches font-semibold line-clamp-1 */}
          <Skeleton className="h-5 w-3/4 mb-1" variant="text" />
          {/* Description — matches text-sm line-clamp-1 */}
          <Skeleton className="h-4 w-full mb-2" variant="text" />
          {/* Price/discount/duration — matches flex items-center gap-3 mt-2 */}
          <div className="flex items-center gap-3 mt-2">
            <Skeleton className="h-5 w-12" variant="text" />
            <Skeleton className="h-4 w-10" variant="text" />
            <Skeleton className="h-4 w-14" variant="text" />
          </div>
        </div>
      </div>
    </GlassCard>
  );
};

// ============================================
// REVIEW SKELETON
// Exact same structure as review cards
// <GlassCard variant="default" className="p-4">
//   flex items-start gap-3 sm:gap-4 min-w-0
//     - w-10 h-10 rounded-full gradient-bg avatar
//     - flex-1: name+date, stars, comment
// ============================================

export const ReviewSkeleton: React.FC = () => {
  return (
    <GlassCard variant="default" hover={false} className="p-4">
      <div className="flex items-start gap-3 sm:gap-4 min-w-0">
        {/* Avatar — matches w-10 h-10 rounded-full gradient-bg */}
        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" variant="circular" />
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 mb-1">
            <div className="min-w-0">
              <Skeleton className="h-4 w-24" variant="text" />
            </div>
            <Skeleton className="h-4 w-16" variant="text" />
          </div>
          {/* Stars — matches flex items-center gap-1 my-1 */}
          <div className="flex items-center gap-1 my-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-4 w-4 rounded-sm" variant="rectangular" />
            ))}
          </div>
          {/* Comment — matches text-muted-foreground line-clamp-3 */}
          <Skeleton className="h-4 w-full mb-1" variant="text" />
          <Skeleton className="h-4 w-5/6" variant="text" />
        </div>
      </div>
    </GlassCard>
  );
};

// ============================================
// MARKETPLACE SKELETON
// Exact same structure as MarketplacePage
// ============================================

export const MarketplaceSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen py-4 sm:py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header — matches h1 + p */}
        <div className="mb-4 sm:mb-6">
          <Skeleton className="h-8 w-56 mb-2" variant="text" />
          <Skeleton className="h-5 w-72" variant="text" />
        </div>

        {/* Search Bar Card — matches glass-card p-3 sm:p-4 mb-4 sm:mb-6 */}
        <GlassCard hover={false} className="p-3 sm:p-4 mb-4 sm:mb-6">
          {/* Primary Search Row — matches flex flex-col lg:flex-row gap-3 */}
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Text Search */}
            <div className="flex-1">
              <Skeleton className="h-3 w-36 mb-1" variant="text" />
              <Skeleton className="h-11 w-full rounded-xl" variant="rectangular" />
            </div>
            {/* Location Search */}
            <div className="flex-1">
              <Skeleton className="h-3 w-16 mb-1" variant="text" />
              <Skeleton className="h-11 w-full rounded-xl" variant="rectangular" />
            </div>
            {/* Search Button */}
            <div className="flex items-end">
              <Skeleton className="h-12 w-full lg:w-32 rounded-xl" variant="rectangular" />
            </div>
          </div>
          {/* Category Chips — matches mt-4 -mb-2 overflow-x-auto */}
          <div className="mt-4 -mb-2 overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 pb-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
                <Skeleton key={i} className="h-9 w-24 rounded-full flex-shrink-0" />
              ))}
            </div>
          </div>
        </GlassCard>

        {/* Filter Bar — matches flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 flex-wrap */}
        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 flex-wrap">
          {/* Mobile Filter Button */}
          <Skeleton className="h-11 w-20 rounded-xl lg:hidden" variant="rectangular" />
          {/* Desktop filter buttons */}
          <div className="hidden lg:flex items-center gap-1">
            <Skeleton className="h-9 w-16 rounded-full" />
            <Skeleton className="h-9 w-16 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
          {/* Sort Dropdown */}
          <Skeleton className="h-11 w-32 rounded-full ml-auto" variant="rectangular" />
          {/* View Toggle */}
          <div className="hidden sm:flex items-center gap-1 p-1 rounded-lg bg-muted/50">
            <Skeleton className="h-9 w-9 rounded" variant="rectangular" />
            <Skeleton className="h-9 w-9 rounded" variant="rectangular" />
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-3 sm:mb-4">
          <Skeleton className="h-5 w-48" variant="text" />
        </div>

        {/* Business Grid — matches grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <BusinessCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================
// HERO SECTION SKELETON
// Exact same structure as HeroSection
// <section className="relative min-h-[80vh] sm:min-h-[90vh] flex items-center hero-pattern overflow-hidden">
//   orbs
//   <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 lg:py-20">
//     <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-center">
//       Left: badge, heading (2 lines), desc, search card, buttons
//       Right: stats grid (2x2), feature cards (3)
//     </div>
//   </div>
//   wave divider
// </section>
// ============================================

export const HeroSectionSkeleton: React.FC = () => {
  return (
    <section className="relative min-h-[80vh] sm:min-h-[90vh] flex items-center hero-pattern overflow-hidden">
      {/* Background Gradient Orbs — same as real */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 sm:w-80 sm:h-80 lg:w-96 lg:h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 sm:w-80 sm:h-80 lg:w-96 lg:h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-center">
          {/* Left Content — same text-center lg:text-left */}
          <div className="text-center lg:text-left">
            {/* Badge — matches inline-flex px-4 py-2 rounded-full bg-primary/10 */}
            <Skeleton className="h-9 w-44 rounded-full mb-6 mx-auto lg:mx-0" variant="rectangular" />

            {/* Heading — matches text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6 */}
            <Skeleton className="h-12 w-64 mb-2 mx-auto lg:mx-0" variant="text" />
            <Skeleton className="h-14 w-48 mb-6 mx-auto lg:mx-0" variant="text" />

            {/* Description — matches text-base sm:text-lg mb-8 max-w-xl */}
            <Skeleton className="h-5 w-full max-w-xl mb-3 mx-auto lg:mx-0" variant="text" />
            <Skeleton className="h-5 w-3/4 max-w-xl mb-8 mx-auto lg:mx-0" variant="text" />

            {/* Search Box — matches glass-card p-3 sm:p-4 mb-8 max-w-xl */}
            <GlassCard hover={false} className="p-3 sm:p-4 mb-8 max-w-xl mx-auto lg:mx-0">
              <div className="flex flex-col gap-3">
                <Skeleton className="h-11 w-full rounded-xl" variant="rectangular" />
                <Skeleton className="h-11 w-full rounded-xl" variant="rectangular" />
                <Skeleton className="h-11 w-full rounded-xl" variant="rectangular" />
              </div>
            </GlassCard>

            {/* Quick Actions — matches flex-wrap justify-center lg:justify-start gap-3 */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
              <Skeleton className="h-11 w-28 rounded-xl" variant="rectangular" />
              <Skeleton className="h-11 w-32 rounded-xl" variant="rectangular" />
            </div>
          </div>

          {/* Right Content — same space-y-6 */}
          <div className="space-y-6">
            {/* Stats Grid — matches grid grid-cols-2 gap-3 sm:gap-4 */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {[1, 2, 3, 4].map((i) => (
                <GlassCard key={i} hover={false} className="p-3 sm:p-4 text-center">
                  {/* Value — matches text-xl sm:text-2xl md:text-3xl font-bold gradient-text */}
                  <Skeleton className="h-8 w-16 mx-auto mb-2" variant="text" />
                  {/* Label — matches text-xs sm:text-sm */}
                  <Skeleton className="h-4 w-24 mx-auto" variant="text" />
                </GlassCard>
              ))}
            </div>

            {/* Feature Cards — matches 3× GlassCard flex items-start gap-3 sm:gap-4 p-3 sm:p-4 */}
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <GlassCard key={i} variant="default" hover={false} className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4">
                  {/* Icon — matches h-10 w-10 sm:h-12 sm:w-12 rounded-xl gradient-bg */}
                  <Skeleton className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex-shrink-0" variant="rectangular" />
                  <div className="min-w-0 flex-1">
                    {/* Title — matches font-semibold text-sm sm:text-base mb-1 */}
                    <Skeleton className="h-5 w-28 mb-1" variant="text" />
                    {/* Description — matches text-xs sm:text-sm line-clamp-2 */}
                    <Skeleton className="h-4 w-full" variant="text" />
                    <Skeleton className="h-4 w-3/4 mt-1" variant="text" />
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Wave Divider — same as real */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg
          viewBox="0 0 1440 60"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto"
          preserveAspectRatio="none"
        >
          <path
            d="M0 60L60 52C120 44 240 28 360 22C480 16 600 20 720 24C840 28 960 32 1080 36C1200 40 1320 40 1380 40L1440 40V60H1380C1320 60 1200 60 1080 60C960 60 840 60 720 60C600 60 480 60 360 60C240 60 120 60 60 60H0Z"
            className="fill-background"
          />
        </svg>
      </div>
    </section>
  );
};

// ============================================
// CATEGORIES SECTION SKELETON
// Exact same structure as CategoriesSection
// <section className="py-10 sm:py-12 lg:py-16 bg-muted/30">
//   <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//     header (text-center mb-8 sm:mb-12)
//     grid (2/3/4 cols) with GlassCard items
//   </div>
// </section>
// ============================================

export const CategoriesSectionSkeleton: React.FC = () => {
  return (
    <section className="py-10 sm:py-12 lg:py-16 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header — matches text-center mb-8 sm:mb-12 */}
        <div className="text-center mb-8 sm:mb-12">
          <Skeleton className="h-8 w-48 mb-3 mx-auto" variant="text" />
          <Skeleton className="h-5 w-72 mx-auto" variant="text" />
        </div>

        {/* Category Grid — matches grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <GlassCard key={i} hover={false} className="p-4 sm:p-5 lg:p-6 text-left">
              {/* Icon — matches h-10 w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14 rounded-xl bg-gradient-to-br */}
              <Skeleton className="h-10 w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14 rounded-xl mb-3 sm:mb-4" variant="rectangular" />
              {/* Name — matches font-semibold text-sm sm:text-base mb-1 */}
              <Skeleton className="h-5 w-24 sm:w-28 mb-1" variant="text" />
              {/* Count — matches text-xs sm:text-sm */}
              <Skeleton className="h-4 w-16 sm:w-20" variant="text" />
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============================================
// CTA SECTION SKELETON
// Exact same structure as CTASection
// <section className="py-12 sm:py-16 lg:py-20 relative overflow-hidden">
//   bg orbs
//   <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
//     <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-center">
//       Left: badge, heading, description, benefits (2x2), buttons
//       Right: glass-card p-5 sm:p-6 lg:p-8 glow with stats + promo
//     </div>
//   </div>
// </section>
// ============================================

export const CTASectionSkeleton: React.FC = () => {
  return (
    <section className="py-12 sm:py-16 lg:py-20 relative overflow-hidden">
      {/* Background — same as real */}
      <div className="absolute inset-0 gradient-bg opacity-10" />
      <div className="absolute top-0 left-1/4 w-64 h-64 sm:w-80 sm:h-80 lg:w-96 lg:h-96 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-64 h-64 sm:w-80 sm:h-80 lg:w-96 lg:h-96 bg-secondary/20 rounded-full blur-3xl" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-center">
          {/* Left Content */}
          <div>
            {/* Badge — matches inline-flex px-4 py-2 rounded-full bg-primary/10 */}
            <Skeleton className="h-9 w-40 rounded-full mb-6" variant="rectangular" />
            {/* Heading — matches text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 */}
            <Skeleton className="h-10 w-72 mb-4 sm:mb-6" variant="text" />
            {/* Description — matches text-base sm:text-lg mb-6 sm:mb-8 */}
            <Skeleton className="h-5 w-full max-w-lg mb-3" variant="text" />
            <Skeleton className="h-5 w-3/4 max-w-lg mb-6 sm:mb-8" variant="text" />

            {/* Benefits — matches grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-6 sm:mb-8 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-6 sm:mb-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-2 min-w-0">
                  {/* Check circle — matches h-5 w-5 rounded-full gradient-bg */}
                  <Skeleton className="h-5 w-5 rounded-full flex-shrink-0" variant="circular" />
                  {/* Text */}
                  <Skeleton className="h-4 w-32" variant="text" />
                </div>
              ))}
            </div>

            {/* Buttons — matches flex flex-wrap gap-4 */}
            <div className="flex flex-wrap gap-4">
              <Skeleton className="h-12 w-44 rounded-xl" variant="rectangular" />
              <Skeleton className="h-12 w-36 rounded-xl" variant="rectangular" />
            </div>
          </div>

          {/* Right Content — Stats Card — matches glass-card p-5 sm:p-6 lg:p-8 glow */}
          <GlassCard hover={false} glow className="p-5 sm:p-6 lg:p-8">
            {/* Header — matches text-center mb-6 sm:mb-8 */}
            <div className="text-center mb-6 sm:mb-8">
              <Skeleton className="h-6 w-48 mx-auto mb-2" variant="text" />
              <Skeleton className="h-4 w-56 mx-auto" variant="text" />
            </div>

            {/* Stats — matches grid grid-cols-2 gap-4 sm:gap-6 */}
            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="text-center min-w-0">
                  <Skeleton className="h-7 w-12 mx-auto mb-1" variant="text" />
                  <Skeleton className="h-4 w-24 mx-auto mb-1" variant="text" />
                  <Skeleton className="h-3 w-12 mx-auto" variant="text" />
                </div>
              ))}
            </div>

            {/* Promo — matches mt-8 p-4 rounded-xl bg-primary/5 border border-primary/10 */}
            <div className="mt-8 p-4 rounded-xl bg-primary/5 border border-primary/10">
              <Skeleton className="h-4 w-80 mx-auto" variant="text" />
            </div>
          </GlassCard>
        </div>
      </div>
    </section>
  );
};

// ============================================
// DASHBOARD SKELETON
// ============================================

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen py-6 sm:py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <Skeleton className="h-8 w-64 mb-2" variant="text" />
          <Skeleton className="h-5 w-48" variant="text" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <GlassCard key={i} hover={false} className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="h-10 w-10 rounded-xl" variant="rectangular" />
                <Skeleton className="h-4 w-12" variant="text" />
              </div>
              <Skeleton className="h-7 w-20 mb-1" variant="text" />
              <Skeleton className="h-4 w-24" variant="text" />
            </GlassCard>
          ))}
        </div>

        {/* Content Cards */}
        <div className="grid lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <GlassCard key={i} hover={false} className="p-4 sm:p-6">
              <Skeleton className="h-6 w-32 mb-4" variant="text" />
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex items-center gap-3 mb-3 pb-3 border-b border-border last:border-0 last:mb-0 last:pb-0">
                  <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" variant="circular" />
                  <div className="flex-1 min-w-0">
                    <Skeleton className="h-4 w-32 mb-1" variant="text" />
                    <Skeleton className="h-3 w-24" variant="text" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </GlassCard>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================
// BOOKING SKELETON
// ============================================

export const BookingSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen py-6 sm:py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <Skeleton className="h-8 w-48 mb-2" variant="text" />
          <Skeleton className="h-5 w-64" variant="text" />
        </div>

        {/* Business info card */}
        <GlassCard hover={false} className="p-4 sm:p-6 mb-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-xl flex-shrink-0" variant="rectangular" />
            <div className="flex-1">
              <Skeleton className="h-5 w-40 mb-2" variant="text" />
              <Skeleton className="h-4 w-24" variant="text" />
            </div>
          </div>
        </GlassCard>

        {/* Service selection */}
        <GlassCard hover={false} className="p-4 sm:p-6 mb-6">
          <Skeleton className="h-6 w-36 mb-4" variant="text" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 mb-3 pb-3 border-b border-border last:border-0">
              <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" variant="rectangular" />
              <div className="flex-1">
                <Skeleton className="h-4 w-28 mb-1" variant="text" />
                <Skeleton className="h-3 w-20" variant="text" />
              </div>
              <Skeleton className="h-5 w-16" variant="text" />
            </div>
          ))}
        </GlassCard>

        {/* Date/Time */}
        <GlassCard hover={false} className="p-4 sm:p-6">
          <Skeleton className="h-6 w-32 mb-4" variant="text" />
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-10 rounded-lg" variant="rectangular" />
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
