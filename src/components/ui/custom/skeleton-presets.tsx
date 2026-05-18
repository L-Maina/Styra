'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/custom/glass-components';

// ============================================
// BUSINESS CARD SKELETON
// Matches the BusinessCard component shape:
// - Image area h-40/h-48
// - Badges (top-left)
// - Favorite button (top-right)
// - Rating badge (bottom-left)
// - Title, subtitle, location, services count
// - Service tags
// ============================================

interface BusinessCardSkeletonProps {
  compact?: boolean;
}

export const BusinessCardSkeleton: React.FC<BusinessCardSkeletonProps> = ({ compact = false }) => {
  return (
    <div className="glass-card overflow-hidden p-0">
      {/* Image Area */}
      <div className="relative h-40 sm:h-48 bg-gradient-to-br from-primary/10 to-secondary/10">
        <Skeleton className="absolute inset-0 rounded-none" variant="rectangular" />
        {/* Badge placeholders */}
        <div className="absolute top-3 left-3 flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
        {/* Favorite button placeholder */}
        <Skeleton className="absolute top-3 right-3 h-11 w-11 rounded-xl" variant="rectangular" />
        {/* Rating badge placeholder */}
        <Skeleton className="absolute bottom-3 left-3 h-7 w-16 rounded-lg" />
      </div>

      {/* Content */}
      <div className="p-3 sm:p-4">
        {/* Title */}
        <Skeleton className="h-5 w-3/4 mb-2" variant="text" />
        {/* Subtitle / description */}
        {!compact && <Skeleton className="h-4 w-full mb-1" variant="text" />}
        {!compact && <Skeleton className="h-4 w-2/3 mb-3" variant="text" />}

        {/* Location & services */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-20" variant="text" />
          <Skeleton className="h-4 w-24" variant="text" />
        </div>

        {/* Service tags */}
        {!compact && (
          <div className="mt-3 flex flex-wrap gap-1">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// BUSINESS PROFILE SKELETON
// Matches the BusinessProfilePage layout:
// - Cover image area (h-48/h-64/h-80)
// - Header card with logo, name, info, buttons
// - Tabs
// - Content grid (services, portfolio, reviews, about)
// ============================================

export const BusinessProfileSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen pb-24">
      {/* Cover Image */}
      <div className="relative h-48 sm:h-64 md:h-80">
        <Skeleton className="absolute inset-0 rounded-none" variant="rectangular" />
        {/* Back button */}
        <Skeleton className="absolute top-4 left-4 h-11 w-11 rounded-xl" variant="rectangular" />
        {/* Action buttons */}
        <div className="absolute top-4 right-4 flex gap-2">
          <Skeleton className="h-11 w-11 rounded-xl" variant="rectangular" />
          <Skeleton className="h-11 w-11 rounded-xl" variant="rectangular" />
        </div>
        {/* Badges */}
        <div className="absolute bottom-4 left-4 flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-10">
        {/* Business Header Card */}
        <div className="glass-card p-4 sm:p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Logo */}
            <Skeleton className="w-16 h-16 sm:w-24 sm:h-24 rounded-xl flex-shrink-0" variant="circular" />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <Skeleton className="h-7 w-48 mb-3" variant="text" />
              <div className="flex flex-wrap items-center gap-4 mb-3">
                <Skeleton className="h-5 w-24" variant="text" />
                <Skeleton className="h-5 w-32" variant="text" />
                <Skeleton className="h-5 w-28" variant="text" />
              </div>
              <div className="flex gap-3">
                <Skeleton className="h-11 w-28 rounded-xl" variant="rectangular" />
                <Skeleton className="h-11 w-28 rounded-xl" variant="rectangular" />
              </div>
              {/* Quick info row */}
              <div className="flex flex-wrap gap-6 mt-4 pt-4 border-t border-border">
                <Skeleton className="h-4 w-28" variant="text" />
                <Skeleton className="h-4 w-32" variant="text" />
                <Skeleton className="h-4 w-24" variant="text" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-24 rounded-lg" variant="rectangular" />
          ))}
        </div>

        {/* Content Grid — Services style */}
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
// Matches the service card in business profile:
// - Icon/image area
// - Title, description, price, duration
// ============================================

export const ServiceCardSkeleton: React.FC = () => {
  return (
    <div className="glass-card p-6">
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        {/* Icon */}
        <Skeleton className="w-16 h-16 rounded-lg flex-shrink-0" variant="rectangular" />
        {/* Content */}
        <div className="flex-1 min-w-0">
          <Skeleton className="h-5 w-3/4 mb-1" variant="text" />
          <Skeleton className="h-4 w-full mb-2" variant="text" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-12" variant="text" />
            <Skeleton className="h-4 w-10" variant="text" />
            <Skeleton className="h-4 w-14" variant="text" />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// REVIEW SKELETON
// Matches the review card in business profile:
// - Avatar circle
// - Name, verified badge
// - Star row
// - Text lines
// ============================================

export const ReviewSkeleton: React.FC = () => {
  return (
    <div className="glass-card p-4">
      <div className="flex items-start gap-3 sm:gap-4 min-w-0">
        {/* Avatar */}
        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" variant="circular" />
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <Skeleton className="h-4 w-24" variant="text" />
            <Skeleton className="h-4 w-16" variant="text" />
          </div>
          {/* Stars */}
          <div className="flex items-center gap-1 my-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-4 w-4 rounded-sm" variant="rectangular" />
            ))}
          </div>
          {/* Text */}
          <Skeleton className="h-4 w-full mb-1" variant="text" />
          <Skeleton className="h-4 w-5/6" variant="text" />
        </div>
      </div>
    </div>
  );
};

// ============================================
// MARKETPLACE SKELETON
// Matches the MarketplacePage layout:
// - Header with title
// - Search bar card
// - Filter bar
// - Grid of BusinessCardSkeletons
// ============================================

export const MarketplaceSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen py-4 sm:py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <Skeleton className="h-8 w-56 mb-2" variant="text" />
          <Skeleton className="h-5 w-72" variant="text" />
        </div>

        {/* Search Bar Card */}
        <div className="glass-card p-3 sm:p-4 mb-4 sm:mb-6">
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
          {/* Category Chips */}
          <div className="mt-4 flex gap-2 overflow-hidden">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton key={i} className="h-9 w-24 rounded-full flex-shrink-0" />
            ))}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-3 mb-3 sm:mb-4">
          <Skeleton className="h-11 w-20 rounded-xl" variant="rectangular" />
          <Skeleton className="h-9 w-16 rounded-full" />
          <Skeleton className="h-9 w-16 rounded-full" />
          <Skeleton className="h-9 w-20 rounded-full" />
        </div>

        {/* Results Count */}
        <div className="mb-3 sm:mb-4">
          <Skeleton className="h-5 w-40" variant="text" />
        </div>

        {/* Business Grid */}
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
// Matches the HeroSection layout:
// - Left: Badge, heading, description, search box, quick actions
// - Right: Stats grid, feature cards
// ============================================

export const HeroSectionSkeleton: React.FC = () => {
  return (
    <section className="relative min-h-[80vh] sm:min-h-[90vh] flex items-center hero-pattern overflow-hidden">
      {/* Background Gradient Orbs (same as real) */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 sm:w-80 sm:h-80 lg:w-96 lg:h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 sm:w-80 sm:h-80 lg:w-96 lg:h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-center">
          {/* Left Content */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <Skeleton className="h-9 w-44 rounded-full mb-6 mx-auto lg:mx-0" variant="rectangular" />

            {/* Heading */}
            <Skeleton className="h-12 w-64 mb-4 mx-auto lg:mx-0" variant="text" />
            <Skeleton className="h-14 w-48 mb-6 mx-auto lg:mx-0" variant="text" />

            {/* Description */}
            <Skeleton className="h-5 w-full max-w-xl mb-3 mx-auto lg:mx-0" variant="text" />
            <Skeleton className="h-5 w-3/4 max-w-xl mb-8 mx-auto lg:mx-0" variant="text" />

            {/* Search Box */}
            <div className="glass-card p-3 sm:p-4 mb-8 max-w-xl mx-auto lg:mx-0">
              <div className="flex flex-col gap-3">
                <Skeleton className="h-11 w-full rounded-xl" variant="rectangular" />
                <Skeleton className="h-11 w-full rounded-xl" variant="rectangular" />
                <Skeleton className="h-11 w-full rounded-xl" variant="rectangular" />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
              <Skeleton className="h-11 w-28 rounded-xl" variant="rectangular" />
              <Skeleton className="h-11 w-32 rounded-xl" variant="rectangular" />
            </div>
          </div>

          {/* Right Content — Stats & Features */}
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="glass-card p-3 sm:p-4 text-center">
                  <Skeleton className="h-8 w-16 mx-auto mb-2" variant="text" />
                  <Skeleton className="h-4 w-24 mx-auto" variant="text" />
                </div>
              ))}
            </div>

            {/* Feature Cards */}
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card flex items-start gap-3 sm:gap-4 p-3 sm:p-4">
                  <Skeleton className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex-shrink-0" variant="rectangular" />
                  <div className="flex-1 min-w-0">
                    <Skeleton className="h-5 w-28 mb-1" variant="text" />
                    <Skeleton className="h-4 w-full" variant="text" />
                    <Skeleton className="h-4 w-3/4 mt-1" variant="text" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Wave Divider */}
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
