'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Newspaper, 
  TrendingUp,
  Clock,
  User,
  Tag,
  ChevronRight,
  Search,
  BookOpen,
  Scissors,
  Heart,
  Star,
  X,
  Share2,
  Bookmark,
  Facebook,
  Twitter,
  Linkedin,
  Link2,
  Loader2,
  Calendar,
  FileSearch
} from 'lucide-react';
import { 
  GlassCard, 
  GlassButton, 
  GlassInput,
  GradientText,
  FadeIn,
  GlassBadge,
} from '@/components/ui/custom/glass-components';
import { cn } from '@/lib/utils';

interface BlogPageProps {
  onBack: () => void;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  image: string;
  category: string;
  author: string;
  authorImage?: string;
  date: string;
  readTime: string;
  isPublished: boolean;
  isFeatured: boolean;
}

const categories = [
  { id: 'all', label: 'All Posts', icon: Newspaper },
  { id: 'tips', label: 'Grooming Tips', icon: Scissors },
  { id: 'trends', label: 'Trends', icon: TrendingUp },
  { id: 'stories', label: 'Success Stories', icon: Star },
  { id: 'guides', label: 'Guides', icon: BookOpen },
];

// Fallback articles when API is not available
const fallbackArticles: BlogPost[] = [
  {
    id: 'featured-1',
    title: "The Ultimate Guide to Men's Grooming in 2025",
    slug: 'ultimate-guide-mens-grooming-2025',
    excerpt: 'Discover the latest trends, techniques, and products that are shaping the grooming industry this year. From skincare routines to hair styling tips.',
    content: `## Introduction

The grooming industry has evolved dramatically over the past few years, and 2025 is shaping up to be a landmark year for men's personal care. In this comprehensive guide, we'll explore the latest trends, essential techniques, and must-have products that every modern man should know about.

## Skincare Revolution

### The Rise of Minimalist Routines

Gone are the days of complicated 10-step skincare routines. In 2025, the focus is on quality over quantity. A simple three-step routine—cleanse, moisturize, protect—is proving to be just as effective as elaborate regimens.

### Key Ingredients to Look For

- **Niacinamide**: Great for controlling oil and minimizing pores
- **Hyaluronic Acid**: Essential for hydration
- **Vitamin C**: Perfect for brightening and protection
- **Retinol**: The gold standard for anti-aging

## Hair Care Trends

### The Textured Look

Natural texture is in. Whether you have waves, curls, or coils, embracing your natural hair pattern is the trend of 2025. Products that enhance rather than control texture are flying off shelves.

### Sustainable Products

Eco-conscious grooming is no longer niche. Bar shampoos, refillable containers, and plastic-free packaging are becoming mainstream choices.

## Beard Maintenance

### The Gentleman's Beard

Well-groomed beards continue to dominate. The key is regular trimming, proper hydration with beard oil, and using a boar bristle brush for distribution.

### Common Mistakes to Avoid

1. Over-washing your beard
2. Using regular shampoo instead of beard wash
3. Neglecting the skin underneath
4. Trimming while wet

## The Future of Grooming

As we look ahead, technology will play an even bigger role in personal care. From AI-powered skincare analysis to personalized product formulations, the future of grooming is smart, sustainable, and tailored to individual needs.

---

*This article was written by our editorial team at Styra. For more grooming tips and advice, explore our blog.*`,
    image: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&h=400&fit=crop',
    category: 'guides',
    author: 'Alexandra Chen',
    authorImage: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=50&h=50&fit=crop&crop=face',
    date: 'Jan 10, 2025',
    readTime: '8 min read',
    isPublished: true,
    isFeatured: true,
  },
  {
    id: '1',
    title: '5 Essential Beard Care Tips for Every Man',
    slug: 'essential-beard-care-tips',
    excerpt: 'Learn the fundamentals of beard maintenance that will keep your facial hair looking its best.',
    content: `## Why Beard Care Matters

A well-maintained beard is more than just facial hair—it's a statement. Here are five essential tips to keep your beard looking its best.

### 1. Wash Your Beard Regularly

Your beard collects dirt, food particles, and skin cells. Use a dedicated beard wash 2-3 times per week to keep it clean without stripping natural oils.

### 2. Moisturize Daily

Beard oil is your best friend. Apply it daily to keep both your beard and the skin underneath hydrated. This prevents itchiness and flaking.

### 3. Trim Regularly

Even if you're growing your beard out, regular trims keep it looking neat. Invest in quality scissors or a good trimmer.

### 4. Brush It Out

Use a boar bristle brush to distribute oils evenly and train your beard to grow in the direction you want.

### 5. Be Patient

Great beards take time. Expect 2-3 months for a full beard to develop properly.

---

*Follow these tips and you'll have a beard that turns heads for all the right reasons.*`,
    image: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=400&h=300&fit=crop',
    category: 'tips',
    author: 'Marcus Johnson',
    authorImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50&h=50&fit=crop&crop=face',
    date: 'Jan 8, 2025',
    readTime: '4 min read',
    isPublished: true,
    isFeatured: false,
  },
  {
    id: '2',
    title: 'Top Hair Trends to Watch in 2025',
    slug: 'top-hair-trends-2025',
    excerpt: "From classic cuts to bold new styles, here's what's trending in men's hair fashion.",
    content: `## The Hair Trends Defining 2025

This year is all about individuality and expression. Here are the top trends we're seeing across barbershops across Africa.

### The Modern Mullet

Yes, it's back—but with a contemporary twist. The 2025 version is more refined, with softer transitions and better styling options.

### Textured Crops

Low-maintenance but high-impact, textured crops work with your natural hair pattern for effortless style.

### The Executive Contour

A sophisticated take on the classic side part, featuring sharp lines and a clean finish. Perfect for professional settings.

### Natural Curls

Men with curly hair are embracing their texture more than ever. The key is finding the right products to define and control without weighing down.

### Bleached Buzz

The buzz cut gets an edgy update with bleaching. It's bold, low-maintenance, and makes a serious statement.

---

*Visit a Styra stylist to find the perfect trend for your face shape and lifestyle.*`,
    image: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=400&h=300&fit=crop',
    category: 'trends',
    author: 'Sophia Martinez',
    authorImage: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=50&h=50&fit=crop&crop=face',
    date: 'Jan 5, 2025',
    readTime: '5 min read',
    isPublished: true,
    isFeatured: false,
  },
  {
    id: '3',
    title: 'From Garage to Success: Elite Cuts Story',
    slug: 'elite-cuts-success-story',
    excerpt: 'How one barber built a thriving business with Styra and dedication.',
    content: `## The Beginning

When Marcus Williams first picked up a pair of clippers in his grandmother's garage, he had no idea that he was about to build a grooming empire. Today, Elite Cuts is one of the most successful barbershops on Styra, with a 4.9 rating and over 500 five-star reviews.

### The Early Days

"It wasn't easy," Marcus recalls. "I was working a 9-to-5 and cutting hair in the evenings. I barely had time to sleep, let alone build a business."

### Finding Styra

Marcus discovered Styra in 2022. Within months of joining the platform, his client base had tripled. "The visibility Styra gave me was game-changing. Suddenly, people who never would have found me were booking appointments."

### The Keys to Success

1. **Consistency**: Marcus never cancels appointments and always runs on time
2. **Quality**: He invests in the best tools and products
3. **Customer Service**: Every client leaves feeling like a VIP
4. **Adaptation**: He's constantly learning new techniques and styles

### Looking Forward

Today, Marcus employs three other barbers and is planning to open a second location. "None of this would have been possible without Styra," he says. "They gave me the platform to turn my passion into a career."

---

*Inspired by Marcus's story? Join Styra as a service provider and start building your success story today.*`,
    image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&h=300&fit=crop',
    category: 'stories',
    author: 'David Kim',
    authorImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=50&h=50&fit=crop&crop=face',
    date: 'Jan 3, 2025',
    readTime: '6 min read',
    isPublished: true,
    isFeatured: false,
  },
  {
    id: '4',
    title: 'Skincare 101: Building Your Daily Routine',
    slug: 'skincare-101-daily-routine',
    excerpt: 'A comprehensive guide to building an effective skincare routine that works.',
    content: `## The Foundation of Good Skin

Skincare doesn't have to be complicated. In fact, the most effective routines are often the simplest. Here's how to build a routine that works for you.

### Step 1: Cleansing

Start and end your day with a gentle cleanser. Look for:
- pH-balanced formulas
- No harsh sulfates
- Ingredients matched to your skin type

**Pro Tip**: Splash your face with lukewarm water—never hot or cold.

### Step 2: Moisturizing

Everyone needs moisturizer, even those with oily skin. The key is finding the right formula:
- Oily skin: Gel or lightweight lotion
- Dry skin: Cream or rich moisturizer
- Combination: Light lotion, applied more heavily on dry areas

### Step 3: Sun Protection

This is non-negotiable. Apply SPF 30+ every morning, even on cloudy days. It's the single most effective anti-aging product available.

### Optional Additions

- **Exfoliation**: 1-2 times per week
- **Serums**: Target specific concerns like dark spots or fine lines
- **Eye Cream**: For those concerned about under-eye issues

---

*Building a routine takes time. Start simple and add products gradually as you learn what works for your skin.*`,
    image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&h=300&fit=crop',
    category: 'guides',
    author: 'Emma Wilson',
    authorImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=50&h=50&fit=crop&crop=face',
    date: 'Dec 28, 2024',
    readTime: '7 min read',
    isPublished: true,
    isFeatured: false,
  },
  {
    id: '5',
    title: 'The Art of the Perfect Fade',
    slug: 'art-of-perfect-fade',
    excerpt: 'Master barbers share their techniques for achieving the perfect fade every time.',
    content: `## Understanding the Fade

The fade is one of the most requested haircuts, and for good reason. It's clean, versatile, and works with almost any style on top.

### Types of Fades

**Skin Fade**: The sides go down to the skin for a dramatic look
**Low Fade**: The fade starts just above the ears
**Mid Fade**: The fade starts around the temples
**High Fade**: The fade starts near the crown

### The Technique

1. **Start with Guards**: Begin with a larger guard and work your way down
2. **Create the Baseline**: This is where the fade begins
3. **Blend, Blend, Blend**: The key is creating a seamless transition
4. **Detail Work**: Clean up the edges and neckline

### Tools of the Trade

- Quality clippers with adjustable blade
- Multiple guard sizes
- A steady hand
- Patience

### Tips from the Pros

"The biggest mistake I see is rushing," says Master Barber James Chen. "A good fade takes time. Don't try to rush the blending process."

---

*Want to experience a master fade? Book with a Styra verified barber today.*`,
    image: 'https://images.unsplash.com/photo-1596728325488-58c87691e9af?w=400&h=300&fit=crop',
    category: 'tips',
    author: 'Marcus Johnson',
    authorImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50&h=50&fit=crop&crop=face',
    date: 'Dec 22, 2024',
    readTime: '5 min read',
    isPublished: true,
    isFeatured: false,
  },
  {
    id: '6',
    title: 'Holiday Grooming: Look Your Best',
    slug: 'holiday-grooming-guide',
    excerpt: 'Get ready for the holidays with these essential grooming tips and tricks.',
    content: `## 'Tis the Season to Look Sharp

The holidays are filled with parties, family gatherings, and photo opportunities. Here's how to make sure you look your best for every occasion.

### The Pre-Event Grooming Checklist

**One Week Before**:
- Get a fresh haircut
- Trim and shape your beard
- Start a hydrating skincare routine

**One Day Before**:
- Exfoliate your face
- Apply a face mask
- Get plenty of sleep

**Day Of**:
- Shower with a quality body wash
- Apply beard oil (if applicable)
- Style your hair
- Apply a subtle fragrance

### Quick Fixes

- **Puffy eyes**: Cold cucumber slices for 10 minutes
- **Dry skin**: Heavy moisturizer applied overnight
- **Unruly hair**: A small amount of styling cream

### Photo-Ready Tips

For those inevitable family photos:
- Stand at a slight angle
- Keep your chin slightly up
- Smile naturally—no forced grins

---

*Make this holiday season your best-looking one yet with Styra's network of top stylists.*`,
    image: 'https://images.unsplash.com/photo-1517832606299-7ae9b720a186?w=400&h=300&fit=crop',
    category: 'tips',
    author: 'Sophia Martinez',
    authorImage: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=50&h=50&fit=crop&crop=face',
    date: 'Dec 18, 2024',
    readTime: '4 min read',
    isPublished: true,
    isFeatured: false,
  },
];

// Helper to process inline markdown (bold, italic) within any line
const processInline = (text: string): string => {
  // Bold text **text**
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
  // Italic text *text*
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return text;
};

// Helper function to convert markdown to readable HTML
const parseMarkdown = (content: string): string => {
  // Split into lines and process each line
  const lines = content.split('\n');
  const processedLines: string[] = [];
  let inList = false;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Skip empty lines but add paragraph breaks
    if (line.trim() === '') {
      if (!inList) processedLines.push('');
      continue;
    }
    
    // Headers
    if (line.startsWith('## ')) {
      line = line.replace(/^## (.+)$/, '<h2 class="text-xl font-bold mt-6 mb-3 text-foreground">$1</h2>');
      inList = false;
    } else if (line.startsWith('### ')) {
      line = line.replace(/^### (.+)$/, '<h3 class="text-lg font-semibold mt-4 mb-2 text-foreground">$1</h3>');
      inList = false;
    }
    // Horizontal rule
    else if (line.trim() === '---') {
      line = '<hr class="my-6 border-t border-border" />';
      inList = false;
    }
    // Unordered list items
    else if (line.startsWith('- ')) {
      line = line.replace(/^- (.+)$/, '<li class="ml-4 list-disc text-muted-foreground">$1</li>');
      line = processInline(line);
      inList = true;
    }
    // Ordered list items
    else if (/^\d+\. /.test(line)) {
      line = line.replace(/^(\d+)\. (.+)$/, '<li class="ml-4 list-decimal text-muted-foreground">$2</li>');
      line = processInline(line);
      inList = true;
    }
    // Regular paragraph
    else {
      line = processInline(line);
      // Wrap in paragraph if not already wrapped
      if (!inList) {
        line = `<p class="mb-4 text-muted-foreground leading-relaxed">${line}</p>`;
      }
      inList = false;
    }
    
    processedLines.push(line);
  }
  
  return processedLines.join('\n');
};

export const BlogPage: React.FC<BlogPageProps> = ({ onBack }) => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<BlogPost | null>(null);
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [articles, setArticles] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savedArticles, setSavedArticles] = useState<string[]>([]);

  // Fetch articles from API
  useEffect(() => {
    const fetchArticles = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/articles');
        if (response.ok) {
          const data = await response.json();
          if (data.articles && data.articles.length > 0) {
            setArticles(data.articles.map((article: Record<string, unknown>) => ({
              ...article,
              date: article.publishedAt 
                ? new Date(article.publishedAt as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : new Date(article.createdAt as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            })));
          } else {
            // Use fallback articles if no articles in database
            setArticles(fallbackArticles);
          }
        } else {
          // Use fallback on error
          setArticles(fallbackArticles);
        }
      } catch {
        // Use fallback on error
        setArticles(fallbackArticles);
      } finally {
        setIsLoading(false);
      }
    };

    fetchArticles();
  }, []);

  // Featured article (first featured or first article)
  const featuredArticle = articles.find(a => a.isFeatured) || articles[0];
  
  // Regular articles (excluding featured)
  const regularArticles = articles.filter(a => a.id !== featuredArticle?.id);

  const filteredPosts = regularArticles.filter(post => {
    const matchesCategory = selectedCategory === 'all' || post.category === selectedCategory;
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const openArticle = useCallback((article: BlogPost) => {
    setSelectedArticle(article);
    setShowArticleModal(true);
  }, []);

  const closeArticle = useCallback(() => {
    setShowArticleModal(false);
    setTimeout(() => setSelectedArticle(null), 300);
  }, []);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setSubscribed(true);
        setEmail('');
      }
    } catch (error) {
      console.error('Newsletter subscription error:', error);
    }
  };

  const shareArticle = useCallback((platform: string) => {
    const url = window.location.href;
    const title = selectedArticle?.title || '';
    
    switch (platform) {
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'linkedin':
        window.open(`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`, '_blank');
        break;
      case 'copy':
        navigator.clipboard.writeText(url);
        break;
    }
  }, [selectedArticle]);

  const toggleSaveArticle = useCallback((articleId: string) => {
    setSavedArticles(prev => 
      prev.includes(articleId) 
        ? prev.filter(id => id !== articleId)
        : [...prev, articleId]
    );
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Decorative Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <FadeIn className="text-center mb-12">
          <motion.div 
            className="w-20 h-20 rounded-2xl gradient-bg flex items-center justify-center mx-auto mb-6 shadow-glow"
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ duration: 0.3 }}
          >
            <Newspaper className="h-10 w-10 text-white" />
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <GradientText>Styra</GradientText> Blog
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Expert tips, trending styles, and stories from the grooming community.
          </p>
        </FadeIn>

        {/* Categories */}
        <FadeIn delay={0.1} className="mb-8">
          <div className="flex flex-wrap gap-2 justify-center">
            {categories.map((cat) => (
              <motion.button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300',
                  selectedCategory === cat.id
                    ? 'gradient-bg text-white shadow-glow-sm'
                    : 'bg-surface/50 backdrop-blur-sm border border-border/20 hover:bg-surface/70'
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <cat.icon className="h-4 w-4" />
                {cat.label}
              </motion.button>
            ))}
          </div>
        </FadeIn>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Featured Post */}
        {!isLoading && featuredArticle && selectedCategory === 'all' && !searchQuery && (
          <FadeIn delay={0.2}>
            <GlassCard 
              className="mb-12 p-0 overflow-hidden cursor-pointer"
              onClick={() => openArticle(featuredArticle)}
            >
              {/* Full-width cover image */}
              <div className="relative h-56 sm:h-72 md:h-80">
                <img
                  src={featuredArticle.image}
                  alt={featuredArticle.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                {/* Floating badges on image */}
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <GlassBadge variant="warning" className="text-sm px-3 py-1">
                    <Star className="h-3 w-3 mr-1" />
                    Featured
                  </GlassBadge>
                  <GlassBadge variant="primary" className="text-sm px-3 py-1">
                    <Tag className="h-3 w-3 mr-1" />
                    {categories.find(c => c.id === featuredArticle.category)?.label}
                  </GlassBadge>
                </div>

                {/* Content overlaid at bottom of image */}
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                  <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-3 leading-tight">
                    {featuredArticle.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-white/80 mb-4">
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {featuredArticle.author}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {featuredArticle.readTime}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {featuredArticle.date}
                    </span>
                  </div>
                  <p className="text-white/70 text-sm md:text-base mb-4 line-clamp-2 max-w-2xl">
                    {featuredArticle.excerpt}
                  </p>
                  <motion.button
                    className="inline-flex items-center gap-2 bg-white text-foreground px-5 py-2.5 rounded-xl font-medium shadow-lg w-fit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openArticle(featuredArticle);
                    }}
                  >
                    Read Article
                    <ChevronRight className="h-4 w-4" />
                  </motion.button>
                </div>
              </div>
            </GlassCard>
          </FadeIn>
        )}

        {/* Blog Posts Grid */}
        {!isLoading && (
          <FadeIn delay={0.3}>
            <h2 className="text-2xl font-bold mb-6">
              {selectedCategory === 'all' ? 'Latest Articles' : categories.find(c => c.id === selectedCategory)?.label}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPosts.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <GlassCard onClick={() => openArticle(post)}>
                    <div className="relative h-48">
                      <img
                        src={post.image}
                        alt={post.title}
                        className="w-full h-full object-cover rounded-t-2xl"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent rounded-t-2xl" />
                      <div className="absolute top-3 left-3">
                        <GlassBadge variant="primary" className="text-xs">
                          {categories.find(c => c.id === post.category)?.label}
                        </GlassBadge>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSaveArticle(post.id);
                        }}
                        className={cn(
                          'absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all',
                          savedArticles.includes(post.id)
                            ? 'bg-primary text-white'
                            : 'bg-white/50 backdrop-blur-sm text-foreground'
                        )}
                      >
                        <Bookmark className={cn('h-4 w-4', savedArticles.includes(post.id) && 'fill-current')} />
                      </button>
                    </div>
                    <div className="p-5">
                      <h3 className="font-semibold mb-2 line-clamp-2 text-lg">{post.title}</h3>
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{post.excerpt}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {post.author}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>{post.date}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {post.readTime}
                          </span>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </FadeIn>
        )}

        {/* Empty State */}
        {!isLoading && filteredPosts.length === 0 && (
          <FadeIn>
            <div className="text-center py-12">
              <FileSearch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No articles found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search or category filter.
              </p>
            </div>
          </FadeIn>
        )}

        {/* Newsletter */}
        <FadeIn delay={0.4}>
          <GlassCard className="mt-12 text-center p-8">
            <Heart className="h-10 w-10 mx-auto mb-4 text-primary" />
            <h2 className="text-2xl font-bold mb-2">Subscribe to Our Newsletter</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Get the latest grooming tips, trends, and exclusive content delivered to your inbox.
            </p>
            {subscribed ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400"
              >
                <Heart className="h-5 w-5" />
                <span className="font-medium">Thanks for subscribing!</span>
              </motion.div>
            ) : (
              <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <GlassInput
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1"
                  required
                />
                <GlassButton variant="primary" type="submit">
                  Subscribe
                </GlassButton>
              </form>
            )}
          </GlassCard>
        </FadeIn>
      </div>

      {/* Article Detail Overlay */}
      <AnimatePresence>
        {showArticleModal && selectedArticle && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex items-start justify-center"
            onClick={closeArticle}
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal — wide, scrollable, max 90vh */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="relative w-full max-w-3xl mx-4 my-4 rounded-2xl overflow-hidden flex flex-col"
              style={{ maxHeight: '90vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header Image */}
              <div className="relative h-48 md:h-56 flex-shrink-0">
                <img
                  src={selectedArticle.image}
                  alt={selectedArticle.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                {/* Close Button */}
                <button
                  onClick={closeArticle}
                  className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors border border-white/20"
                >
                  <X className="h-5 w-5 text-white" />
                </button>

                {/* Category Badge */}
                <div className="absolute bottom-4 left-4">
                  <GlassBadge variant="primary" className="text-sm px-3 py-1">
                    <Tag className="h-3 w-3 mr-1" />
                    {categories.find(c => c.id === selectedArticle.category)?.label}
                  </GlassBadge>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto bg-background">
                <div className="p-6 md:p-8">
                  {/* Title */}
                  <h1 className="text-2xl md:text-3xl font-bold mb-4">{selectedArticle.title}</h1>

                  {/* Author & Meta */}
                  <div className="flex flex-wrap items-center gap-4 mb-6 pb-6 border-b border-border">
                    <div className="flex items-center gap-3">
                      {selectedArticle.authorImage ? (
                        <img
                          src={selectedArticle.authorImage}
                          alt={selectedArticle.author}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center">
                          <User className="h-5 w-5 text-white" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{selectedArticle.author}</p>
                        <p className="text-sm text-muted-foreground">{selectedArticle.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
                      <Clock className="h-4 w-4" />
                      {selectedArticle.readTime}
                    </div>
                  </div>

                  {/* Article Body */}
                  <div
                    className="prose prose-slate dark:prose-invert max-w-none mb-8 text-muted-foreground leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(selectedArticle.content) }}
                  />

                  {/* Share Section */}
                  <div className="border-t border-border pt-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Share:</span>
                        <div className="flex items-center gap-2">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => shareArticle('facebook')}
                            className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center hover:bg-blue-700 transition-colors"
                          >
                            <Facebook className="h-4 w-4 text-white" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => shareArticle('twitter')}
                            className="w-9 h-9 rounded-full bg-sky-500 flex items-center justify-center hover:bg-sky-600 transition-colors"
                          >
                            <Twitter className="h-4 w-4 text-white" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => shareArticle('linkedin')}
                            className="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center hover:bg-blue-800 transition-colors"
                          >
                            <Linkedin className="h-4 w-4 text-white" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => shareArticle('copy')}
                            className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                          >
                            <Link2 className="h-4 w-4" />
                          </motion.button>
                        </div>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggleSaveArticle(selectedArticle.id)}
                        className={cn(
                          'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                          savedArticles.includes(selectedArticle.id)
                            ? 'bg-primary text-white'
                            : 'bg-muted/50 hover:bg-muted text-foreground'
                        )}
                      >
                        <Bookmark className={cn('h-4 w-4', savedArticles.includes(selectedArticle.id) && 'fill-current')} />
                        {savedArticles.includes(selectedArticle.id) ? 'Saved' : 'Save Article'}
                      </motion.button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BlogPage;
