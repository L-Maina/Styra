'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Newspaper,
  Clock,
  User,
  Tag,
  ChevronRight,
  Star,
  X,
  AlertTriangle,
  RefreshCw,
  FileSearch,
  Bookmark,
  Calendar,
} from 'lucide-react';
import {
  GlassCard,
  GlassButton,
  GlassBadge,
  FadeIn,
  GradientText,
} from '@/components/ui/custom/glass-components';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BlogPageProps {
  onNavigate?: (page: string) => void;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  image?: string;
  category?: string;
  author?: string;
  authorImage?: string;
  date: string;
  readTime: string;
  isFeatured: boolean;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

const SkeletonCard: React.FC = () => (
  <div className="rounded-2xl bg-surface/50 animate-pulse border border-border/10">
    <div className="h-48 bg-muted/40 rounded-t-2xl" />
    <div className="p-5 space-y-3">
      <div className="h-4 w-20 bg-muted/40 rounded-full" />
      <div className="h-5 w-full bg-muted/30 rounded" />
      <div className="h-5 w-3/4 bg-muted/30 rounded" />
      <div className="h-4 w-full bg-muted/20 rounded" />
      <div className="flex justify-between pt-2">
        <div className="h-3 w-24 bg-muted/20 rounded" />
        <div className="h-3 w-16 bg-muted/20 rounded" />
      </div>
    </div>
  </div>
);

const ErrorState: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <FadeIn>
    <GlassCard className="text-center p-10 max-w-md mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-5">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="text-xl font-bold mb-2">Failed to Load Articles</h3>
      <p className="text-muted-foreground text-sm mb-6">{message}</p>
      <GlassButton variant="primary" onClick={onRetry}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Try Again
      </GlassButton>
    </GlassCard>
  </FadeIn>
);

const EmptyState: React.FC<{ hasFilter: boolean }> = ({ hasFilter }) => (
  <FadeIn>
    <div className="text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-5">
        <FileSearch className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold mb-2">
        {hasFilter ? 'No articles in this category' : 'No articles yet'}
      </h3>
      <p className="text-muted-foreground text-sm max-w-sm mx-auto">
        {hasFilter
          ? 'Try selecting a different category to find what you are looking for.'
          : 'Check back soon — new content is on the way.'}
      </p>
    </div>
  </FadeIn>
);

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export const BlogPage: React.FC<BlogPageProps> = ({ onNavigate }) => {
  const [articles, setArticles] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<BlogPost | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [savedArticles, setSavedArticles] = useState<string[]>([]);

  /* ---- Data fetching ---- */
  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/articles');
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const json = await res.json();

      const mapped: BlogPost[] = (json.data?.articles ?? []).map(
        (a: Record<string, unknown>) => {
          const rawDate = (a.publishedAt ?? a.createdAt) as string;
          const date = rawDate
            ? new Date(rawDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : '';
          const mins =
            typeof a.readTime === 'number'
              ? `${a.readTime} min read`
              : (a.readTime as string) || '5 min read';
          return { ...a, date, readTime: mins } as BlogPost;
        },
      );
      setArticles(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  /* ---- Derived data ---- */
  const uniqueCategories = Array.from(
    new Set(articles.map((a) => a.category).filter(Boolean) as string[]),
  );
  const categoryTabs = ['all', ...uniqueCategories];

  const featuredArticle = articles.find((a) => a.isFeatured) || null;
  const regularArticles = articles.filter((a) => a.id !== featuredArticle?.id);

  const filteredPosts =
    selectedCategory === 'all'
      ? regularArticles
      : articles.filter((a) => a.category === selectedCategory);

  /* ---- Handlers ---- */
  const openArticle = useCallback((article: BlogPost) => {
    setSelectedArticle(article);
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setTimeout(() => setSelectedArticle(null), 300);
  }, []);

  const toggleSave = useCallback((id: string) => {
    setSavedArticles((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */
  return (
    <div className="min-h-screen bg-background">
      {/* Decorative blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* ---------- Hero ---------- */}
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

        {/* ---------- Category Tabs ---------- */}
        {!loading && !error && articles.length > 0 && (
          <FadeIn delay={0.1} className="mb-10">
            <div className="flex flex-wrap gap-2 justify-center">
              {categoryTabs.map((cat) => {
                const label = cat === 'all' ? 'All Posts' : cat.charAt(0).toUpperCase() + cat.slice(1);
                return (
                  <motion.button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300',
                      selectedCategory === cat
                        ? 'gradient-bg text-white shadow-glow-sm'
                        : 'bg-surface/50 backdrop-blur-sm border border-border/20 hover:bg-surface/70',
                    )}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {cat === 'all' && <Newspaper className="h-4 w-4" />}
                    {label}
                  </motion.button>
                );
              })}
            </div>
          </FadeIn>
        )}

        {/* ---------- Loading Skeleton ---------- */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* ---------- Error State ---------- */}
        {!loading && error && <ErrorState message={error} onRetry={fetchArticles} />}

        {/* ---------- Content (not loading, no error) ---------- */}
        {!loading && !error && (
          <>
            {/* Featured Article */}
            {featuredArticle && selectedCategory === 'all' && (
              <FadeIn delay={0.2}>
                <GlassCard
                  className="mb-12 p-0 overflow-hidden cursor-pointer"
                  onClick={() => openArticle(featuredArticle)}
                >
                  <div className="relative h-56 sm:h-72 md:h-80">
                    <img
                      src={featuredArticle.image || '/images/blog-placeholder.svg'}
                      alt={featuredArticle.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                    <div className="absolute top-4 left-4 flex items-center gap-2">
                      <GlassBadge variant="warning" className="text-sm px-3 py-1">
                        <Star className="h-3 w-3 mr-1" />
                        Featured
                      </GlassBadge>
                      {featuredArticle.category && (
                        <GlassBadge variant="primary" className="text-sm px-3 py-1">
                          <Tag className="h-3 w-3 mr-1" />
                          {featuredArticle.category}
                        </GlassBadge>
                      )}
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                      <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-3 leading-tight">
                        {featuredArticle.title}
                      </h2>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-white/80 mb-4">
                        {featuredArticle.author && (
                          <span className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            {featuredArticle.author}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {featuredArticle.readTime}
                        </span>
                        {featuredArticle.date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {featuredArticle.date}
                          </span>
                        )}
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

            {/* Section heading */}
            <FadeIn delay={0.25}>
              <h2 className="text-2xl font-bold mb-6">
                {selectedCategory === 'all'
                  ? 'Latest Articles'
                  : selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)}
              </h2>
            </FadeIn>

            {/* Article Grid */}
            {filteredPosts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPosts.map((post, idx) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <GlassCard onClick={() => openArticle(post)}>
                      {/* Image */}
                      <div className="relative h-48 bg-muted/20 rounded-t-2xl overflow-hidden">
                        {post.image ? (
                          <img
                            src={post.image}
                            alt={post.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
                            <Newspaper className="h-10 w-10 text-muted-foreground/40" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent rounded-t-2xl" />
                        {post.category && (
                          <div className="absolute top-3 left-3">
                            <GlassBadge variant="primary" className="text-xs">
                              {post.category}
                            </GlassBadge>
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSave(post.id);
                          }}
                          className={cn(
                            'absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all',
                            savedArticles.includes(post.id)
                              ? 'bg-primary text-white'
                              : 'bg-white/50 backdrop-blur-sm text-foreground',
                          )}
                        >
                          <Bookmark
                            className={cn(
                              'h-4 w-4',
                              savedArticles.includes(post.id) && 'fill-current',
                            )}
                          />
                        </button>
                      </div>
                      {/* Body */}
                      <div className="p-5">
                        <h3 className="font-semibold mb-2 line-clamp-2 text-lg">{post.title}</h3>
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                          {post.excerpt}
                        </p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>{post.author || 'Anonymous'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span>{post.date}</span>
                            <span>·</span>
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
            ) : (
              <EmptyState hasFilter={selectedCategory !== 'all' && articles.length > 0} />
            )}
          </>
        )}
      </div>

      {/* ---------- Article Detail Modal ---------- */}
      <AnimatePresence>
        {showModal && selectedArticle && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex items-start justify-center"
            onClick={closeModal}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="relative w-full max-w-3xl mx-4 my-4 rounded-2xl overflow-hidden flex flex-col bg-background"
              style={{ maxHeight: '90vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header image */}
              <div className="relative h-48 md:h-56 flex-shrink-0">
                <img
                  src={selectedArticle.image || '/images/blog-placeholder.svg'}
                  alt={selectedArticle.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <button
                  onClick={closeModal}
                  className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors border border-white/20"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
                {selectedArticle.category && (
                  <div className="absolute bottom-4 left-4">
                    <GlassBadge variant="primary" className="text-sm px-3 py-1">
                      <Tag className="h-3 w-3 mr-1" />
                      {selectedArticle.category}
                    </GlassBadge>
                  </div>
                )}
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-6 md:p-8">
                  <h1 className="text-2xl md:text-3xl font-bold mb-4">{selectedArticle.title}</h1>
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
                        <p className="font-medium">{selectedArticle.author || 'Anonymous'}</p>
                        <p className="text-sm text-muted-foreground">{selectedArticle.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
                      <Clock className="h-4 w-4" />
                      {selectedArticle.readTime}
                    </div>
                  </div>
                  <div
                    className="prose prose-slate dark:prose-invert max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap"
                  >
                    {selectedArticle.content}
                  </div>
                  <div className="border-t border-border pt-6 mt-8 flex items-center justify-end gap-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => toggleSave(selectedArticle.id)}
                      className={cn(
                        'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                        savedArticles.includes(selectedArticle.id)
                          ? 'bg-primary text-white'
                          : 'bg-muted/50 hover:bg-muted text-foreground',
                      )}
                    >
                      <Bookmark
                        className={cn(
                          'h-4 w-4',
                          savedArticles.includes(selectedArticle.id) && 'fill-current',
                        )}
                      />
                      {savedArticles.includes(selectedArticle.id) ? 'Saved' : 'Save Article'}
                    </motion.button>
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
