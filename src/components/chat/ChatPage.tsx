'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Send, 
  MoreVertical,
  Phone,
  Video,
  Image as ImageIcon,
  Smile,
  ChevronLeft,
  User,
  Paperclip,
  X,
  PhoneOff,
  VideoOff,
  Mic,
  MicOff,
  Camera,
  FileText,
  Check,
  CheckCheck,
  Ban,
  UserX,
  Flag,
  BellOff,
  Bot,
  Sparkles,
  Eye,
  Info,
} from 'lucide-react';
import { 
  GlassCard, 
  GlassButton, 
  GlassInput,
  GlassBadge,
  FadeIn,
} from '@/components/ui/custom/glass-components';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { User as UserType } from '@/types';
import { AuthPromptModal } from '@/components/auth/AuthPromptModal';

interface ChatPageProps {
  user: UserType | null;
  onNavigate?: (page: string) => void;
}

// Types matching the API response
interface ApiConversation {
  id: string;
  participant1: string;
  participant2: string;
  lastMessage?: string;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
  otherUser?: {
    id: string;
    name: string;
    avatar?: string;
  };
  messages?: ApiMessage[];
}

interface ApiMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  sender?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

// Emoji data
const emojiCategories = {
  smileys: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛'],
  gestures: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👋', '🖐️', '✋', '👏', '🙌', '👐', '🤲', '🙏', '✍️', '💪', '🦾', '🤝'],
  objects: ['💄', '💅', '💇', '💆', '🧴', '🧼', '🪥', '🪮', '💈', '💉', '🩹', '🩺', '💊', '💉', '🧪', '🌡️', '🧬', '🔬', '📡', '💊'],
  hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️'],
};

const STYRA_AI_ID = 'styra-ai';

export const ChatPage: React.FC<ChatPageProps> = ({ user, onNavigate }) => {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // UI States
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCallModal, setShowCallModal] = useState<'voice' | 'video' | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [emojiCategory, setEmojiCategory] = useState<keyof typeof emojiCategories>('smileys');
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  
  // Check if user is authenticated
  const isAuthenticated = !!user;
  // Admin detection — admins cannot send messages as participants
  const isAdmin = !!user?.roles?.includes('ADMIN');

  // AI Chat state
  const [aiMessages, setAiMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; content: string; createdAt: string }>>([]);
  const [isAiTyping, setIsAiTyping] = useState(false);

  // Whether the selected conversation is the AI chat
  const isAiChat = selectedConversation === STYRA_AI_ID;

  // Conversations state
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Fetch conversations list ─────────────────────────────────
  const fetchConversations = useCallback(async () => {
    setIsLoadingConversations(true);
    setError(null);
    try {
      const res = await fetch('/api/conversations', {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`Failed to load conversations (${res.status})`);
      }
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setConversations(json.data);
      } else {
        setConversations([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  // ─── Fetch messages for a specific conversation ───────────────
  const fetchMessages = useCallback(async (conversationId: string) => {
    setIsLoadingMessages(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}?limit=100`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`Failed to load messages (${res.status})`);
      }
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setMessages(json.data);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // Initial conversations load
  useEffect(() => {
    if (isAuthenticated) {
      fetchConversations();
    } else {
      setIsLoadingConversations(false);
    }
  }, [isAuthenticated, fetchConversations]);

  // ─── Load messages when conversation is selected ──────────────
  useEffect(() => {
    if (selectedConversation && isAuthenticated) {
      fetchMessages(selectedConversation);
    } else {
      setMessages([]);
    }
  }, [selectedConversation, isAuthenticated, fetchMessages]);

  // ─── Poll for new messages every 4 seconds ────────────────────
  useEffect(() => {
    if (!selectedConversation || !isAuthenticated) return;

    const pollInterval = setInterval(() => {
      fetchMessages(selectedConversation);
      // Also refresh conversation list to update unread counts
      fetchConversations();
    }, 4000);

    return () => clearInterval(pollInterval);
  }, [selectedConversation, isAuthenticated, fetchMessages, fetchConversations]);

  const selectedConv = conversations.find((c) => c.id === selectedConversation);

  const filteredConversations = conversations.filter((c) =>
    c.otherUser?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCallActive && showCallModal) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isCallActive, showCallModal]);

  // ─── Send AI message ────────────────────────────────────────────
  const handleSendAiMessage = async () => {
    if (!message.trim() || isAiTyping) return;

    const userContent = message.trim();
    setMessage('');
    setShowEmojiPicker(false);

    const userMsg = {
      id: `ai-user-${Date.now()}`,
      role: 'user' as const,
      content: userContent,
      createdAt: new Date().toISOString(),
    };
    setAiMessages(prev => [...prev, userMsg]);
    setIsAiTyping(true);

    try {
      const res = await fetch('/api/chat/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userContent,
          conversationHistory: aiMessages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error('AI response failed');
      }
      const json = await res.json();
      const aiContent = json.data?.message || json.message || "I'm sorry, I couldn't process that.";

      setAiMessages(prev => [...prev, {
        id: `ai-assistant-${Date.now()}`,
        role: 'assistant',
        content: aiContent,
        createdAt: new Date().toISOString(),
      }]);
    } catch (err) {
      toast.error('Styra AI is temporarily unavailable', {
        description: 'Please try again in a moment.',
      });
    } finally {
      setIsAiTyping(false);
    }
  };

  // ─── Send message via API ─────────────────────────────────────
  const handleSendMessage = async (type: 'text' | 'image' | 'file' = 'text', fileData?: { url: string; name: string }) => {
    // If this is the AI chat, delegate to AI handler
    if (isAiChat) {
      await handleSendAiMessage();
      return;
    }

    // Require authentication to send messages
    if (!isAuthenticated) {
      setShowAuthPrompt(true);
      return;
    }
    
    // Admin cannot send participant messages
    if (isAdmin) {
      return;
    }

    if (!message.trim() && type === 'text' && !fileData) return;
    if (!selectedConversation) return;

    const content = type === 'text' ? message.trim() : (fileData?.name || '');
    if (!content) return;

    setIsSendingMessage(true);
    setMessage('');
    setShowEmojiPicker(false);

    try {
      const res = await fetch(`/api/conversations/${selectedConversation}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Failed to send message (${res.status})`);
      }

      // Immediately refresh messages and conversations
      await Promise.all([
        fetchMessages(selectedConversation),
        fetchConversations(),
      ]);

      if (type === 'image') {
        toast.success('Image sent!');
      }
    } catch (err) {
      toast.error('Failed to send message', {
        description: err instanceof Error ? err.message : 'Please try again',
      });
      // Restore message text on failure
      if (type === 'text') {
        setMessage(content);
      }
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File too large', { description: 'Maximum file size is 5MB' });
        return;
      }
      
      // Create a preview URL
      const url = URL.createObjectURL(file);
      handleSendMessage('image', { url, name: file.name });
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage(prev => prev + emoji);
  };

  const startCall = (type: 'voice' | 'video') => {
    setShowCallModal(type);
    setIsCallActive(false);
    setCallDuration(0);
    // Simulate call connecting
    setTimeout(() => {
      setIsCallActive(true);
      toast.success(`${type === 'video' ? 'Video' : 'Voice'} call connected`);
    }, 2000);
  };

  const endCall = () => {
    setIsCallActive(false);
    setShowCallModal(null);
    setCallDuration(0);
    toast.info('Call ended');
  };

  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (dateInput: string | Date) => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const moreMenuItems = [
    { icon: BellOff, label: 'Mute notifications', onClick: () => { setIsMuted(!isMuted); toast.success(isMuted ? 'Notifications unmuted' : 'Notifications muted'); setShowMoreMenu(false); } },
    { icon: FileText, label: 'View shared files', onClick: () => { toast.info('Viewing shared files'); setShowMoreMenu(false); } },
    { icon: Ban, label: 'Block user', onClick: () => { toast.error('User blocked'); setShowMoreMenu(false); } },
    { icon: Flag, label: 'Report', onClick: () => { toast.info('Report submitted'); setShowMoreMenu(false); } },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-[calc(100vh-4rem)] flex relative"
    >
      {/* Full chat layout — always visible so AI chat is accessible to everyone */}
      <>
      {/* Conversations List */}
      <div className={`w-full md:w-80 lg:w-96 border-r border-border flex flex-col ${selectedConversation ? 'hidden md:flex' : ''}`}>
        {/* Header */}
        <div className="p-4 border-b border-border">
          <h1 className="text-xl font-bold mb-4">Messages</h1>
          <GlassInput
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {/* Styra AI - Pinned at top, accessible to everyone including guests and admins */}
          <FadeIn>
            <button
              onClick={() => setSelectedConversation(STYRA_AI_ID)}
              className={cn(
                "w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors border-b border-border",
                selectedConversation === STYRA_AI_ID ? 'bg-muted/50' : ''
              )}
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-full gradient-bg flex items-center justify-center text-white">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-background" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between">
                  <span className="font-semibold truncate">Styra AI</span>
                  <GlassBadge variant="primary" className="text-[10px] px-1.5 py-0.5">AI</GlassBadge>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {aiMessages.length > 0 ? aiMessages[aiMessages.length - 1].content : "Ask me anything about Styra!"}
                </p>
              </div>
            </button>
          </FadeIn>

          {/* Divider between AI chat and regular conversations */}
          {isAuthenticated && filteredConversations.length > 0 && (
            <div className="px-4 py-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Messages</p>
            </div>
          )}

          {/* Loading State */}
          {isAuthenticated && isLoadingConversations && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-muted-foreground">Loading conversations…</p>
            </div>
          )}

          {/* Error State */}
          {!isLoadingConversations && error && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center mx-auto mb-3">
                <X className="h-6 w-6 text-red-500" />
              </div>
              <p className="text-sm font-medium mb-1">Something went wrong</p>
              <p className="text-xs text-muted-foreground mb-3">{error}</p>
              <GlassButton variant="outline" size="sm" onClick={fetchConversations}>
                Retry
              </GlassButton>
            </div>
          )}

          {/* Empty State — show auth prompt for guests, regular empty for authenticated */}
          {isAuthenticated && !isLoadingConversations && !error && filteredConversations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <Send className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">No conversations yet</p>
              <p className="text-xs text-muted-foreground">
                Start a chat with a business from their profile page.
              </p>
            </div>
          )}

          {/* Guest prompt for conversations section */}
          {!isAuthenticated && !isLoadingConversations && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <User className="h-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">Sign in to view messages</p>
              <p className="text-xs text-muted-foreground mb-3">
                You need an account to chat with businesses.
              </p>
              <GlassButton size="sm" onClick={() => onNavigate?.('login')}>
                Sign In
              </GlassButton>
            </div>
          )}

          {/* Conversation List */}
          {isAuthenticated && !isLoadingConversations && !error && filteredConversations.length > 0 && filteredConversations.map((conversation, index) => (
            <FadeIn key={conversation.id} delay={0.05 * index}>
              <button
                onClick={() => setSelectedConversation(conversation.id)}
                className={`w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors ${
                  selectedConversation === conversation.id ? 'bg-muted/50' : ''
                }`}
              >
                <div className="relative">
                  {conversation.otherUser?.avatar ? (
                    <img 
                      src={conversation.otherUser.avatar} 
                      alt={conversation.otherUser.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full gradient-bg flex items-center justify-center text-white font-bold">
                      {conversation.otherUser?.name?.[0] || '?'}
                    </div>
                  )}
                  {conversation.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center">
                      {conversation.unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold truncate">{conversation.otherUser?.name || 'Unknown User'}</span>
                    <span className="text-xs text-muted-foreground">
                      {conversation.lastMessageAt ? formatTime(conversation.lastMessageAt) : ''}
                    </span>
                  </div>
                  <p className={`text-sm truncate ${conversation.unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                    {conversation.lastMessage || 'No messages yet'}
                  </p>
                </div>
              </button>
            </FadeIn>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col ${!selectedConversation ? 'hidden md:flex' : ''}`}>
        {isAiChat ? (
          <>
            {/* AI Chat Header */}
            <div className="p-4 border-b border-border flex items-center gap-3">
              <button
                onClick={() => setSelectedConversation(null)}
                className="md:hidden p-2 -ml-2 hover:bg-muted rounded-lg"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center text-white">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">Styra AI</h2>
                <div className="flex items-center gap-1 text-sm text-green-600">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  {isAiTyping ? 'Typing...' : 'Always online'}
                </div>
              </div>
              <div className="ml-auto">
                <GlassBadge variant="primary" className="text-[10px]">AI Assistant</GlassBadge>
              </div>
            </div>

            {/* AI Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {aiMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 rounded-full gradient-bg flex items-center justify-center mb-4">
                    <Bot className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="font-semibold mb-2">Hi, I'm Styra AI!</h3>
                  <p className="text-muted-foreground text-sm text-center max-w-sm">
                    I can help you find services, understand how Styra works, answer payment questions, and more. Try asking me anything!
                  </p>
                </div>
              )}

              {aiMessages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                      msg.role === 'user'
                        ? 'gradient-bg text-white rounded-br-md'
                        : 'bg-muted rounded-bl-md'
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <Sparkles className="h-3 w-3 text-primary" />
                        <span className="text-xs font-medium text-primary">Styra AI</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                    <p
                      className={`text-xs mt-1 ${msg.role === 'user' ? 'text-white/70 text-right' : 'text-muted-foreground'}`}
                    >
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                </motion.div>
              ))}

              {/* AI Typing Indicator */}
              {isAiTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* AI Chat Input — always visible (works without auth) */}
            <div className="p-4 border-t border-border">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    placeholder="Ask Styra AI anything..."
                    disabled={isAiTyping}
                    className="w-full h-10 px-4 pr-12 rounded-full border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                  />
                </div>
                <GlassButton
                  variant="primary"
                  size="icon"
                  onClick={() => handleSendMessage()}
                  disabled={!message.trim() || isAiTyping}
                >
                  {isAiTyping ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </GlassButton>
              </div>
            </div>
          </>
        ) : selectedConv ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="md:hidden p-2 -ml-2 hover:bg-muted rounded-lg"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                {selectedConv.otherUser?.avatar ? (
                  <img 
                    src={selectedConv.otherUser.avatar} 
                    alt={selectedConv.otherUser.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center text-white font-bold">
                    {selectedConv.otherUser?.name?.[0] || '?'}
                  </div>
                )}
                <div>
                  <h2 className="font-semibold">{selectedConv.otherUser?.name || 'Unknown User'}</h2>
                  <div className="flex items-center gap-1 text-sm text-green-600">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    Online
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <GlassButton 
                  variant="ghost" 
                  size="icon"
                  onClick={() => startCall('voice')}
                  className="hover:bg-green-500/20 hover:text-green-600"
                >
                  <Phone className="h-5 w-5" />
                </GlassButton>
                <GlassButton 
                  variant="ghost" 
                  size="icon"
                  onClick={() => startCall('video')}
                  className="hover:bg-green-500/20 hover:text-green-600"
                >
                  <Video className="h-5 w-5" />
                </GlassButton>
                <div className="relative">
                  <GlassButton 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                  >
                    <MoreVertical className="h-5 w-5" />
                  </GlassButton>
                  
                  {/* More Menu Dropdown */}
                  <AnimatePresence>
                    {showMoreMenu && (
                      <>
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="fixed inset-0 z-40"
                          onClick={() => setShowMoreMenu(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 top-full mt-1 w-48 bg-background/95 border border-border/50 rounded-lg shadow-lg z-50 overflow-hidden"
                        >
                          {moreMenuItems.map((item, index) => (
                            <button
                              key={index}
                              onClick={item.onClick}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-sm"
                            >
                              <item.icon className="h-4 w-4" />
                              {item.label}
                            </button>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Loading Messages */}
              {isLoadingMessages && messages.length === 0 && (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading messages...</span>
                </div>
              )}

              {/* No Messages */}
              {!isLoadingMessages && messages.length === 0 && (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-muted-foreground">No messages yet. Say hello!</p>
                </div>
              )}

              {/* Message List */}
              {messages.map((msg, index) => {
                const isFromMe = msg.senderId === user?.id;
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0 }}
                    className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                        isFromMe
                          ? 'gradient-bg text-white rounded-br-md'
                          : 'bg-muted rounded-bl-md'
                      }`}
                    >
                      <p>{msg.content}</p>
                      <p
                        className={`text-xs mt-1 flex items-center gap-1 ${
                          isFromMe ? 'text-white/70 justify-end' : 'text-muted-foreground'
                        }`}
                      >
                        {formatTime(msg.createdAt)}
                        {isFromMe && (
                          <span className={cn(
                            "ml-1 text-[10px] uppercase tracking-wide",
                            msg.isRead ? "text-white/90" : "text-white/50"
                          )}>
                            {msg.isRead ? 'seen' : 'sent'}
                          </span>
                        )}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input — hidden for admin users */}
            {!isAdmin && (
            <div className="p-4 border-t border-border">
              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
              
              <div className="flex items-end gap-2">
                <div className="flex gap-1">
                  {/* Image Button */}
                  <GlassButton 
                    variant="ghost" 
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    className="hover:bg-primary/20 hover:text-primary"
                  >
                    <ImageIcon className="h-5 w-5" />
                  </GlassButton>
                  
                  {/* Emoji Button */}
                  <div className="relative">
                    <GlassButton 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className={cn("hover:bg-primary/20 hover:text-primary", showEmojiPicker && "bg-primary/20 text-primary")}
                    >
                      <Smile className="h-5 w-5" />
                    </GlassButton>
                    
                    {/* Emoji Picker */}
                    <AnimatePresence>
                      {showEmojiPicker && (
                        <>
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40"
                            onClick={() => setShowEmojiPicker(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute bottom-full mb-2 left-0 w-72 bg-background/95 border border-border/50 rounded-xl shadow-lg z-50 overflow-hidden"
                          >
                            {/* Emoji Categories */}
                            <div className="flex border-b border-border">
                              {Object.keys(emojiCategories).map((cat) => (
                                <button
                                  key={cat}
                                  onClick={() => setEmojiCategory(cat as keyof typeof emojiCategories)}
                                  className={cn(
                                    "flex-1 py-2 text-sm font-medium capitalize transition-colors",
                                    emojiCategory === cat ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
                                  )}
                                >
                                  {cat}
                                </button>
                              ))}
                            </div>
                            {/* Emoji Grid */}
                            <div className="p-2 grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                              {emojiCategories[emojiCategory].map((emoji, index) => (
                                <button
                                  key={index}
                                  onClick={() => handleEmojiSelect(emoji)}
                                  className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded text-lg transition-transform hover:scale-125"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    placeholder="Type a message..."
                    disabled={isSendingMessage}
                    className="w-full h-10 px-4 pr-12 rounded-full border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                  />
                </div>
                <GlassButton
                  variant="primary"
                  size="icon"
                  onClick={() => handleSendMessage()}
                  disabled={!message.trim() || isSendingMessage}
                >
                  {isSendingMessage ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </GlassButton>
              </div>
            </div>
            )}
            {/* Admin read-only notice */}
            {isAdmin && (
              <div className="p-4 border-t border-border">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <Eye className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Admin view — you cannot send messages in user conversations.
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <User className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-2">Select a conversation</h3>
              <p className="text-muted-foreground mb-3">
                Choose a conversation from the list, or chat with <button onClick={() => setSelectedConversation(STYRA_AI_ID)} className="text-primary font-medium hover:underline">Styra AI</button> for help.
              </p>
            </div>
          </div>
        )}
      </div>
      </>

      {/* Call Modal */}
      <AnimatePresence>
        {showCallModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-modal rounded-2xl p-8 text-center max-w-sm w-full mx-4"
            >
              {/* Avatar */}
              <div className="w-24 h-24 rounded-full gradient-bg flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">
                {selectedConv?.otherUser?.name?.[0] || '?'}
              </div>
              
              <h3 className="text-xl font-semibold mb-1">{selectedConv?.otherUser?.name}</h3>
              <p className="text-muted-foreground mb-6">
                {isCallActive 
                  ? formatCallDuration(callDuration)
                  : 'Calling...'
                }
              </p>

              {/* Video Preview for Video Call */}
              {showCallModal === 'video' && isCallActive && (
                <div className="mb-6 aspect-video rounded-lg bg-muted flex items-center justify-center">
                  <Video className="h-12 w-12 text-muted-foreground" />
                </div>
              )}

              {/* Call Controls */}
              <div className="flex items-center justify-center gap-4">
                {isCallActive && (
                  <>
                    <GlassButton
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsMuted(!isMuted)}
                      className={cn(
                        "w-12 h-12 rounded-full",
                        isMuted ? "bg-red-500 text-white" : "bg-muted hover:bg-muted/80"
                      )}
                    >
                      {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    </GlassButton>
                    
                    {showCallModal === 'video' && (
                      <GlassButton
                        variant="ghost"
                        size="icon"
                        className="w-12 h-12 rounded-full bg-muted hover:bg-muted/80"
                      >
                        <Camera className="h-5 w-5" />
                      </GlassButton>
                    )}
                  </>
                )}
                
                <GlassButton
                  variant="outline"
                  size="icon"
                  onClick={endCall}
                  className="w-14 h-14 rounded-full text-red-500 border-red-500 hover:bg-red-500/10"
                >
                  {showCallModal === 'video' ? <VideoOff className="h-6 w-6" /> : <PhoneOff className="h-6 w-6" />}
                </GlassButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auth Prompt Modal */}
      <AuthPromptModal
        isOpen={showAuthPrompt}
        onClose={() => setShowAuthPrompt(false)}
        action="message"
        onSignIn={() => {
          setShowAuthPrompt(false);
          onNavigate?.('login');
        }}
        onSignUp={() => {
          setShowAuthPrompt(false);
          onNavigate?.('register');
        }}
      />
    </motion.div>
  );
};

export default ChatPage;
