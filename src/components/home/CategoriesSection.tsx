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

interface CategoriesSectionProps {
  onSelectCategory?: (category: string) => void;
  onNavigate?: (page: string) => void;
}

const categories = [
  {
    id: 'haircuts',
    name: 'Haircuts & Styling',
    icon: Scissors,
    color: 'from-purple-500 to-pink-500',
    count: '2.5K+',
  },
  {
    id: 'beard',
    name: 'Beard Grooming',
    icon: HandMetal,
    color: 'from-amber-500 to-orange-500',
    count: '1.8K+',
  },
  {
    id: 'coloring',
    name: 'Hair Coloring',
    icon: Palette,
    color: 'from-blue-500 to-cyan-500',
    count: '1.2K+',
  },
  {
    id: 'nails',
    name: 'Nail Services',
    icon: Hand,
    color: 'from-pink-500 to-rose-500',
    count: '900+',
  },
  {
    id: 'skincare',
    name: 'Skin Care',
    icon: Flower2,
    color: 'from-green-500 to-emerald-500',
    count: '750+',
  },
  {
    id: 'makeup',
    name: 'Makeup',
    icon: Gem,
    color: 'from-violet-500 to-purple-500',
    count: '600+',
  },
  {
    id: 'spa',
    name: 'Spa & Wellness',
    icon: Heart,
    color: 'from-teal-500 to-cyan-500',
    count: '500+',
  },
  {
    id: 'massage',
    name: 'Massage',
    icon: Wind,
    color: 'from-indigo-500 to-blue-500',
    count: '400+',
  },
];

export const CategoriesSection: React.FC<CategoriesSectionProps> = ({
  onSelectCategory,
  onNavigate,
}) => {
  const handleCategoryClick = (categoryId: string) => {
    onSelectCategory?.(categoryId);
    onNavigate?.('marketplace');
  };

  return (
    <section className="py-16 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Explore by <span className="gradient-text">Category</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Find the perfect grooming service for your style. From haircuts to spa treatments,
              we've got you covered.
            </p>
          </div>
        </FadeIn>

        <StaggerChildren className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((category) => (
            <StaggerItem key={category.id}>
              <GlassCard
                hover
                onClick={() => handleCategoryClick(category.id)}
                className="p-6 text-left group cursor-pointer"
              >
                <div
                  className={`h-14 w-14 rounded-xl bg-gradient-to-br ${category.color} 
                    flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                >
                  <category.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-semibold mb-1">{category.name}</h3>
                <p className="text-sm text-muted-foreground">{category.count} providers</p>
              </GlassCard>
            </StaggerItem>
          ))}
        </StaggerChildren>
      </div>
    </section>
  );
};

export default CategoriesSection;
