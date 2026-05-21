'use client';

import React from 'react';
import { 
  Scissors, 
  Palette, 
  Hand, 
  Flower2, 
  Heart, 
  Gem,
  Wind,
  HandMetal,
} from 'lucide-react';
import { FadeIn, StaggerChildren, StaggerItem, GlassCard } from '@/components/ui/custom/glass-components';

export interface ApiCategory {
  name: string;
  slug: string;
  count: number;
}

interface CategoriesSectionProps {
  onSelectCategory?: (category: string) => void;
  onNavigate?: (page: string) => void;
  apiCategories?: ApiCategory[];
  isLoading?: boolean;
}

// Static category definitions — icons, colours, slugs
// No fabricated counts; real counts come from apiCategories prop
const categoryDefs = [
  {
    id: 'haircuts',
    name: 'Haircuts & Styling',
    icon: Scissors,
    color: 'from-purple-500 to-pink-500',
  },
  {
    id: 'beard',
    name: 'Beard Grooming',
    icon: HandMetal,
    color: 'from-amber-500 to-orange-500',
  },
  {
    id: 'coloring',
    name: 'Hair Coloring',
    icon: Palette,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'nails',
    name: 'Nail Services',
    icon: Hand,
    color: 'from-pink-500 to-rose-500',
  },
  {
    id: 'skincare',
    name: 'Skin Care',
    icon: Flower2,
    color: 'from-green-500 to-emerald-500',
  },
  {
    id: 'makeup',
    name: 'Makeup',
    icon: Gem,
    color: 'from-violet-500 to-purple-500',
  },
  {
    id: 'spa',
    name: 'Spa & Wellness',
    icon: Heart,
    color: 'from-teal-500 to-cyan-500',
  },
  {
    id: 'massage',
    name: 'Massage',
    icon: Wind,
    color: 'from-indigo-500 to-blue-500',
  },
];

/** Format a numeric count for display (e.g. 1200 → "1.2K") */
function formatCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(count);
}

export const CategoriesSection: React.FC<CategoriesSectionProps> = ({
  onSelectCategory,
  onNavigate,
  apiCategories,
  isLoading,
}) => {
  const handleCategoryClick = (categoryId: string) => {
    onSelectCategory?.(categoryId);
    onNavigate?.('marketplace');
  };

  // Build a lookup: slug → count from API data
  const countBySlug = React.useMemo(() => {
    if (!apiCategories?.length) return new Map<string, number>();
    return new Map(apiCategories.map((c) => [c.slug, c.count]));
  }, [apiCategories]);

  return (
    <section className="py-10 sm:py-12 lg:py-16 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3">
              Explore by <span className="gradient-text">Category</span>
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
              Find the perfect grooming service for your style. From haircuts to spa treatments,
              we&apos;ve got you covered.
            </p>
          </div>
        </FadeIn>

        <StaggerChildren className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {categoryDefs.map((category) => {
            const realCount = countBySlug.get(category.id) ?? countBySlug.get(category.name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')) ?? null;

            return (
              <StaggerItem key={category.id}>
                <GlassCard
                  hover
                  onClick={() => handleCategoryClick(category.id)}
                  className="p-4 sm:p-5 lg:p-6 text-left group cursor-pointer"
                >
                  <div
                    className={`h-10 w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14 rounded-xl bg-gradient-to-br ${category.color} 
                      flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform`}
                  >
                    <category.icon className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-white" />
                  </div>
                  <h3 className="font-semibold text-sm sm:text-base mb-1 line-clamp-1">{category.name}</h3>
                  {isLoading ? (
                    <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                  ) : realCount !== null ? (
                    <p className="text-xs sm:text-sm text-muted-foreground">{formatCount(realCount)} providers</p>
                  ) : null}
                </GlassCard>
              </StaggerItem>
            );
          })}
        </StaggerChildren>
      </div>
    </section>
  );
};

export default CategoriesSection;
