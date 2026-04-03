'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  HelpCircle, 
  MessageSquare, 
  Phone, 
  Mail,
  ChevronDown,
  ChevronUp,
  Search,
  Clock,
  CreditCard,
  User,
  Calendar,
  Shield,
  Settings,
  MessageCircle,
  Send,
  X,
  CheckCircle2,
  AlertCircle,
  Bot,
  BookOpen,
  FileText,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { 
  GlassCard, 
  GlassButton, 
  GlassInput,
  GradientText,
  FadeIn,
  GlassBadge,
  GlassModal
} from '@/components/ui/custom/glass-components';
import { useAuthStore } from '@/store';
import { AuthPromptModal } from '@/components/auth/AuthPromptModal';

interface SupportPageProps {
  onBack: () => void;
  onNavigate?: (page: string) => void;
}

const faqCategories = [
  { id: 'all', label: 'All Topics' },
  { id: 'booking', label: 'Booking & Appointments' },
  { id: 'payment', label: 'Payments & Refunds' },
  { id: 'account', label: 'Account & Profile' },
  { id: 'provider', label: 'Service Provider' },
];

const faqs = [
  {
    category: 'booking',
    question: 'How do I book an appointment?',
    answer: 'Simply browse our marketplace or map to find a service provider, select your desired service, choose an available time slot, and complete your booking with our secure payment system. You\'ll receive a confirmation email and SMS with all the details.',
    keywords: ['book', 'appointment', 'schedule', 'reserve'],
  },
  {
    category: 'booking',
    question: 'Can I reschedule or cancel my appointment?',
    answer: 'Yes! You can reschedule or cancel your appointment through your dashboard up to 24 hours before the scheduled time for a full refund. Cancellations within 24 hours may incur a fee of up to 50% of the service price.',
    keywords: ['reschedule', 'cancel', 'change', 'modify'],
  },
  {
    category: 'booking',
    question: 'What if my service provider cancels?',
    answer: 'If a provider cancels your appointment, you\'ll receive a full refund automatically. We\'ll also help you find an alternative provider if you\'d like.',
    keywords: ['provider cancel', 'cancelled', 'provider cancels'],
  },
  {
    category: 'payment',
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit and debit cards (Visa, Mastercard, American Express), PayPal, Apple Pay, Google Pay, and M-Pesa in supported regions. All payments are processed securely through our PCI-compliant payment system.',
    keywords: ['payment', 'pay', 'credit card', 'debit', 'paypal', 'mpesa'],
  },
  {
    category: 'payment',
    question: 'When will I receive my refund?',
    answer: 'Refunds are typically processed within 3-5 business days and will appear on your original payment method. The exact timing depends on your bank or payment provider.',
    keywords: ['refund', 'money back', 'return'],
  },
  {
    category: 'payment',
    question: 'Is my payment information secure?',
    answer: 'Absolutely. We use industry-standard encryption and never store your complete card details. All transactions are processed through PCI DSS compliant payment processors.',
    keywords: ['secure', 'security', 'safe', 'encryption'],
  },
  {
    category: 'account',
    question: 'How do I create an account?',
    answer: 'Click "Sign Up" on our homepage, enter your email address and create a password, or sign up quickly using Google or Facebook. You\'ll need to verify your email to complete registration.',
    keywords: ['create account', 'sign up', 'register', 'new account'],
  },
  {
    category: 'account',
    question: 'I forgot my password. What should I do?',
    answer: 'Click "Forgot Password" on the login page and enter your email address. We\'ll send you a link to reset your password. The link expires after 24 hours for security.',
    keywords: ['forgot password', 'reset password', 'password'],
  },
  {
    category: 'account',
    question: 'How do I delete my account?',
    answer: 'Go to Settings > Account > Delete Account in your dashboard. Note that this action is irreversible and you\'ll lose access to your booking history and saved providers.',
    keywords: ['delete account', 'remove account', 'close account'],
  },
  {
    category: 'provider',
    question: 'How do I become a service provider?',
    answer: 'Click "Become a Provider" and complete the onboarding process. You\'ll need to provide your business information, services offered, pricing, and any required licenses. Our team will review your application within 2-3 business days.',
    keywords: ['become provider', 'service provider', 'list business', 'vendor'],
  },
  {
    category: 'provider',
    question: 'What fees does Styra charge?',
    answer: 'Styra charges a commission fee on completed bookings, which varies by subscription plan. Free tier providers pay 15%, Premium tier pays 10%, and Featured tier pays 8%. Detailed fee structures are available in your provider dashboard.',
    keywords: ['fees', 'commission', 'charges', 'pricing'],
  },
  {
    category: 'provider',
    question: 'How do I receive my earnings?',
    answer: 'Earnings are automatically transferred to your linked bank account on a weekly basis. You can also request instant payouts for a small fee. Minimum payout threshold is KES 2,500.',
    keywords: ['earnings', 'payout', 'withdraw', 'bank'],
  },
];

const helpTopics = [
  { id: 'booking', icon: Calendar, title: 'Managing Bookings', articles: 12, description: 'Book, reschedule, and cancel appointments' },
  { id: 'payment', icon: CreditCard, title: 'Payment Issues', articles: 8, description: 'Payments, refunds, and billing' },
  { id: 'account', icon: User, title: 'Account Settings', articles: 15, description: 'Profile, security, and preferences' },
  { id: 'security', icon: Shield, title: 'Safety & Security', articles: 6, description: 'Privacy and account protection' },
  { id: 'technical', icon: Settings, title: 'Technical Support', articles: 10, description: 'App issues and troubleshooting' },
];

const popularArticles = [
  { id: 1, title: 'Getting Started Guide', category: 'account', readTime: '3 min' },
  { id: 2, title: 'How to Cancel a Booking', category: 'booking', readTime: '2 min' },
  { id: 3, title: 'Understanding Refunds', category: 'payment', readTime: '4 min' },
  { id: 4, title: 'Provider Onboarding', category: 'provider', readTime: '5 min' },
];

export const SupportPage: React.FC<SupportPageProps> = ({ onBack, onNavigate }) => {
  const { isAuthenticated } = useAuthStore();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showLiveChat, setShowLiveChat] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{type: 'user' | 'bot', message: string, timestamp: Date}>>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedHelpTopic, setSelectedHelpTopic] = useState<string | null>(null);
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<typeof popularArticles[0] | null>(null);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Focus chat input when modal opens
  useEffect(() => {
    if (showLiveChat) {
      setTimeout(() => chatInputRef.current?.focus(), 100);
    }
  }, [showLiveChat]);

  // Filter FAQs based on category and search
  const filteredFaqs = faqs.filter(faq => {
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.keywords?.some(kw => kw.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Handle help topic click
  const handleHelpTopicClick = (topicId: string) => {
    setSelectedHelpTopic(topicId);
    if (topicId === 'security' || topicId === 'technical') {
      setSelectedCategory('all');
    } else {
      setSelectedCategory(topicId);
    }
    // Scroll to FAQ section
    document.getElementById('faq-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle popular article click
  const handleArticleClick = (article: typeof popularArticles[0]) => {
    setSelectedArticle(article);
    setShowArticleModal(true);
  };

  // Handle contact form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Require authentication to submit support requests
    if (!isAuthenticated) {
      setShowAuthPrompt(true);
      return;
    }
    
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'SUPPORT',
          ...contactForm,
        }),
      });

      if (response.ok) {
        setSubmitStatus('success');
        setContactForm({ name: '', email: '', subject: '', message: '' });
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle live chat
  const handleStartChat = () => {
    setShowLiveChat(true);
    setChatMessages([
      { type: 'bot', message: 'Hello! 👋 Welcome to Styra Support. How can I help you today?', timestamp: new Date() }
    ]);
  };

  // Generate AI-like response based on user message
  const generateBotResponse = (userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase();
    
    // Booking related
    if (lowerMessage.includes('book') || lowerMessage.includes('appointment') || lowerMessage.includes('schedule')) {
      return "I'd be happy to help with bookings! 📅 To book an appointment:\n\n1. Browse businesses on our Explore page\n2. Select a service provider\n3. Choose your service and time slot\n4. Complete payment\n\nYou'll receive a confirmation email and SMS. Would you like more details?";
    }
    
    // Refund related
    if (lowerMessage.includes('refund') || lowerMessage.includes('money back')) {
      return "For refund inquiries 💰:\n\n• Refunds are processed within 3-5 business days\n• Full refunds for cancellations 24+ hours before appointment\n• Go to Dashboard > My Bookings > Select booking > 'Request Refund'\n\nNeed help with a specific refund request?";
    }
    
    // Cancellation related
    if (lowerMessage.includes('cancel')) {
      return "To cancel a booking:\n\n1. Go to your Dashboard\n2. Click on 'My Bookings'\n3. Select the booking you want to cancel\n4. Click 'Cancel Booking'\n\n⚠️ Cancellations within 24 hours may incur a fee. Would you like me to help you with anything else?";
    }
    
    // Payment related
    if (lowerMessage.includes('pay') || lowerMessage.includes('card') || lowerMessage.includes('charge')) {
      return "We accept multiple payment methods 💳:\n\n• Credit/Debit Cards (Visa, Mastercard, Amex)\n• PayPal\n• Apple Pay & Google Pay\n• M-Pesa (select regions)\n\nAll payments are secure and encrypted. Having a specific payment issue?";
    }
    
    // Account related
    if (lowerMessage.includes('account') || lowerMessage.includes('password') || lowerMessage.includes('login')) {
      return "For account issues 🔐:\n\n• Forgot password? Click 'Forgot Password' on login\n• Need to verify email? Check your spam folder\n• Want to delete account? Go to Settings > Account\n\nI can help you with any of these. What would you like to do?";
    }
    
    // Provider related
    if (lowerMessage.includes('provider') || lowerMessage.includes('business') || lowerMessage.includes('vendor')) {
      return "Interested in becoming a provider? 🎯\n\n1. Click 'Become a Provider' in the menu\n2. Complete your business profile\n3. Add your services and pricing\n4. Submit for review (2-3 business days)\n\nCommission rates: Free tier (15%), Premium (10%), Featured (8%). Want more info?";
    }
    
    // Contact human agent
    if (lowerMessage.includes('human') || lowerMessage.includes('agent') || lowerMessage.includes('person')) {
      return "I understand you'd like to speak with a human agent. 🤝\n\nOur support team is available:\n• Mon-Fri: 8am-6pm EAT\n• Phone: +254 712 345 678\n• Email: support@styra.app\n\nOr fill out the contact form below and we'll respond within 24 hours!";
    }
    
    // Default response
    return "Thanks for your message! I'm here to help. 🌟\n\nI can assist with:\n• Booking appointments\n• Refunds and cancellations\n• Payment issues\n• Account management\n• Becoming a provider\n\nCould you tell me more about what you need help with?";
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    const userMessage = chatMessage;
    setChatMessages(prev => [...prev, { type: 'user', message: userMessage, timestamp: new Date() }]);
    setChatMessage('');
    setIsTyping(true);

    // Simulate typing delay
    setTimeout(() => {
      const botResponse = generateBotResponse(userMessage);
      setChatMessages(prev => [...prev, { type: 'bot', message: botResponse, timestamp: new Date() }]);
      setIsTyping(false);
    }, 800 + Math.random() * 700);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-60 h-60 rounded-full bg-gradient-to-br from-secondary/10 to-primary/10 blur-3xl" />
        <div className="absolute bottom-20 right-10 w-40 h-40 rounded-full bg-gradient-to-br from-primary/5 to-secondary/5 blur-2xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <FadeIn className="text-center mb-12">
          <motion.div 
            className="w-20 h-20 rounded-2xl gradient-bg flex items-center justify-center mx-auto mb-6 shadow-glow"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <HelpCircle className="h-10 w-10 text-white" />
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            How Can We <GradientText>Help You?</GradientText>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-8 text-lg">
            Find answers to common questions or get in touch with our support team.
          </p>
          
          {/* Search */}
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <GlassInput
                placeholder="Search for help articles, FAQs, topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="h-5 w-5" />}
                className="w-full text-base py-6 pl-12 pr-4 h-14 rounded-2xl shadow-lg border-white/30"
              />
              {searchQuery && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                >
                  <GlassBadge variant="primary">{filteredFaqs.length} results</GlassBadge>
                </motion.div>
              )}
            </div>
          </div>
        </FadeIn>

        {/* Popular Articles */}
        {searchQuery === '' && (
          <FadeIn delay={0.05} className="mb-8">
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <span className="text-sm text-muted-foreground">Popular:</span>
              {popularArticles.map((article) => (
                <motion.button
                  key={article.id}
                  onClick={() => handleArticleClick(article)}
                  className="glass-button px-4 py-2 rounded-full text-sm hover:bg-primary/10 transition-all"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-3 w-3" />
                    {article.title}
                  </span>
                </motion.button>
              ))}
            </div>
          </FadeIn>
        )}

        {/* Quick Help Topics */}
        <FadeIn delay={0.1} className="mb-12">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {helpTopics.map((topic, index) => (
              <motion.div
                key={topic.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <GlassCard 
                  hover 
                  glow={selectedHelpTopic === topic.id}
                  className={`text-center cursor-pointer transition-all ${
                    selectedHelpTopic === topic.id ? 'ring-2 ring-primary/50 border-primary/30' : ''
                  }`}
                  onClick={() => handleHelpTopicClick(topic.id)}
                >
                  <div className={`w-14 h-14 rounded-xl mx-auto mb-3 flex items-center justify-center ${
                    selectedHelpTopic === topic.id 
                      ? 'gradient-bg shadow-glow-sm' 
                      : 'bg-primary/10'
                  }`}>
                    <topic.icon className={`h-7 w-7 ${
                      selectedHelpTopic === topic.id ? 'text-white' : 'text-primary'
                    }`} />
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{topic.title}</h3>
                  <p className="text-xs text-muted-foreground mb-2">{topic.description}</p>
                  <GlassBadge variant={selectedHelpTopic === topic.id ? 'primary' : 'default'}>
                    {topic.articles} articles
                  </GlassBadge>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </FadeIn>

        {/* FAQ Section */}
        <div id="faq-section" className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <FadeIn delay={0.2} className="lg:col-span-2">
            <GlassCard variant="elevated" className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Frequently Asked Questions
                </h2>
                {searchQuery && (
                  <GlassBadge variant="primary">
                    {filteredFaqs.length} result{filteredFaqs.length !== 1 ? 's' : ''}
                  </GlassBadge>
                )}
              </div>
              
              {/* Category Tabs */}
              <div className="flex flex-wrap gap-2 mb-6">
                {faqCategories.map((cat) => (
                  <GlassButton
                    key={cat.id}
                    variant={selectedCategory === cat.id ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    {cat.label}
                  </GlassButton>
                ))}
              </div>

              {/* Search Results Count */}
              {searchQuery && (
                <p className="text-sm text-muted-foreground mb-4">
                  Showing results for &quot;{searchQuery}&quot;
                </p>
              )}

              {/* FAQ List */}
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
                <AnimatePresence mode="popLayout">
                  {filteredFaqs.map((faq, index) => (
                    <motion.div
                      key={faq.question}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: index * 0.03 }}
                      className="glass-card rounded-xl overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedFaq(expandedFaq === faq.question ? null : faq.question)}
                        className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-primary/5 transition-colors"
                      >
                        <span className="font-medium text-sm pr-4">{faq.question}</span>
                        <motion.div
                          animate={{ rotate: expandedFaq === faq.question ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        </motion.div>
                      </button>
                      <AnimatePresence>
                        {expandedFaq === faq.question && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 pt-2 border-t border-border/50">
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {faq.answer}
                              </p>
                              <div className="mt-3 flex items-center gap-2">
                                <GlassBadge variant="default" className="text-xs">
                                  {faqCategories.find(c => c.id === faq.category)?.label}
                                </GlassBadge>
                                <span className="text-xs text-muted-foreground">Was this helpful?</span>
                                <button className="text-xs text-primary hover:underline">Yes</button>
                                <button className="text-xs text-muted-foreground hover:text-primary">No</button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {filteredFaqs.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-12"
                  >
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                      <HelpCircle className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground mb-2">No FAQs found matching your search.</p>
                    <p className="text-sm text-muted-foreground mb-4">Try different keywords or browse by category</p>
                    <GlassButton 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('all');
                      }}
                    >
                      Clear filters
                    </GlassButton>
                  </motion.div>
                )}
              </div>
            </GlassCard>
          </FadeIn>

          {/* Contact Options */}
          <FadeIn delay={0.3}>
            <div className="space-y-4">
              {/* Live Chat */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <GlassCard 
                  variant="gradient" 
                  className="cursor-pointer overflow-hidden relative gradient-bg"
                  onClick={handleStartChat}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-secondary/30" />
                  <div className="relative flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <MessageCircle className="h-7 w-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">Live Chat</h3>
                      <p className="text-sm text-white/80">Available 24/7</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400"></span>
                      </span>
                      <GlassBadge variant="success">Online</GlassBadge>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>

              {/* Phone */}
              <GlassCard hover className="group">
                <a href="tel:+254712345678" className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl gradient-bg flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-all">
                    <Phone className="h-7 w-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Phone Support</h3>
                    <p className="text-sm text-muted-foreground">Mon-Fri 8am-6pm EAT</p>
                    <p className="text-sm text-primary font-medium">+254 712 345 678</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </a>
              </GlassCard>

              {/* Email */}
              <GlassCard hover className="group">
                <a href="mailto:support@styra.app" className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl gradient-bg flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-all">
                    <Mail className="h-7 w-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Email Us</h3>
                    <p className="text-sm text-muted-foreground">Response within 24 hours</p>
                    <p className="text-sm text-primary font-medium">support@styra.app</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </a>
              </GlassCard>

              {/* Hours */}
              <GlassCard variant="bordered">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Support Hours</p>
                    <p className="text-xs text-muted-foreground">24/7 chat • Mon-Fri phone</p>
                  </div>
                </div>
              </GlassCard>
            </div>
          </FadeIn>
        </div>

        {/* Contact Form */}
        <FadeIn delay={0.4}>
          <GlassCard variant="elevated" className="relative overflow-hidden">
            {/* Decorative gradient */}
            <div className="absolute top-0 left-0 right-0 h-1 gradient-bg" />
            
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
                  <Send className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Send Us a Message</h2>
                  <p className="text-sm text-muted-foreground">We&apos;ll get back to you within 24 hours</p>
                </div>
              </div>
              
              {/* Status Messages */}
              <AnimatePresence>
                {submitStatus === 'success' && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium text-green-700 dark:text-green-400">Message sent successfully!</p>
                      <p className="text-sm text-green-600 dark:text-green-500">We&apos;ll get back to you within 24 hours.</p>
                    </div>
                  </motion.div>
                )}
                
                {submitStatus === 'error' && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="font-medium text-red-700 dark:text-red-400">Failed to send message</p>
                      <p className="text-sm text-red-600 dark:text-red-500">Please try again or contact us directly.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Name</label>
                    <GlassInput
                      placeholder="Your name"
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      required
                      className="h-11"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Email</label>
                    <GlassInput
                      type="email"
                      placeholder="your@email.com"
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      required
                      className="h-11"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Subject</label>
                  <GlassInput
                    placeholder="How can we help?"
                    value={contactForm.subject}
                    onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                    required
                    className="h-11"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Message</label>
                  <textarea
                    placeholder="Describe your issue or question in detail..."
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    className="w-full min-h-[140px] p-4 rounded-xl border border-input bg-surface/50 backdrop-blur-sm text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none transition-all"
                    required
                  />
                </div>
                <div className="flex justify-end">
                  <GlassButton 
                    type="submit" 
                    variant="primary"
                    size="lg"
                    rightIcon={isSubmitting ? undefined : <Send className="h-4 w-4" />}
                    disabled={isSubmitting}
                    isLoading={isSubmitting}
                  >
                    {isSubmitting ? 'Sending...' : 'Send Message'}
                  </GlassButton>
                </div>
              </form>
            </div>
          </GlassCard>
        </FadeIn>
      </div>

      {/* Live Chat Modal */}
      <AnimatePresence>
        {showLiveChat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowLiveChat(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 100, opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="glass-modal w-full max-w-md overflow-hidden shadow-2xl rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="gradient-bg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Bot className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Styra AI Support</h3>
                    <p className="text-xs text-white/80 flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                      </span>
                      Online • Typically replies instantly
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowLiveChat(false)}
                  className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>

              {/* Messages */}
              <div className="h-80 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-muted/30 to-transparent">
                {chatMessages.map((msg, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] p-3 ${
                        msg.type === 'user'
                          ? 'bg-primary text-white rounded-2xl rounded-br-md'
                          : 'bg-white/80 backdrop-blur-sm border border-border/50 rounded-2xl rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-line">{msg.message}</p>
                      <p className={`text-[10px] mt-1 ${
                        msg.type === 'user' ? 'text-white/60' : 'text-muted-foreground'
                      }`}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </motion.div>
                ))}
                
                {/* Typing indicator */}
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start"
                  >
                    <div className="bg-white/80 backdrop-blur-sm border border-border/50 rounded-2xl rounded-bl-md p-3">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSendChatMessage} className="p-4 border-t border-border/50 bg-surface/50 backdrop-blur-sm">
                <div className="flex gap-2">
                  <input
                    ref={chatInputRef}
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-3 rounded-xl border border-input bg-surface/80 backdrop-blur-sm text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                  <motion.button
                    type="submit"
                    disabled={!chatMessage.trim()}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center shadow-glow-sm hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="h-5 w-5 text-white" />
                  </motion.button>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Powered by AI • Ask about bookings, payments, accounts & more
                </p>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Article Modal */}
      <GlassModal
        isOpen={showArticleModal}
        onClose={() => setShowArticleModal(false)}
        title={selectedArticle?.title}
        size="lg"
      >
        {selectedArticle && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <GlassBadge variant="primary">
                {faqCategories.find(c => c.id === selectedArticle.category)?.label || selectedArticle.category}
              </GlassBadge>
              <span className="text-sm text-muted-foreground">
                {selectedArticle.readTime} read
              </span>
            </div>
            
            <div className="prose prose-sm max-w-none">
              <p className="text-muted-foreground">
                This article covers everything you need to know about {selectedArticle.title.toLowerCase()}.
              </p>
              
              <h4 className="font-semibold mt-4">Quick Summary</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                  Step-by-step instructions available
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                  Video tutorials included
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                  Related FAQs linked below
                </li>
              </ul>
              
              <div className="mt-6 p-4 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-sm font-medium mb-2">Need more help?</p>
                <div className="flex gap-2">
                  <GlassButton 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      setShowArticleModal(false);
                      handleStartChat();
                    }}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Chat with us
                  </GlassButton>
                </div>
              </div>
            </div>
          </div>
        )}
      </GlassModal>

      {/* Auth Prompt Modal */}
      <AuthPromptModal
        isOpen={showAuthPrompt}
        onClose={() => setShowAuthPrompt(false)}
        action="support"
        onSignIn={() => {
          setShowAuthPrompt(false);
          onNavigate?.('login');
        }}
        onSignUp={() => {
          setShowAuthPrompt(false);
          onNavigate?.('register');
        }}
      />
    </div>
  );
};

export default SupportPage;
