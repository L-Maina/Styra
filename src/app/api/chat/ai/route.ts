import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, successResponse } from '@/lib/api-utils';

/**
 * POST /api/chat/ai - Styra AI Chat Endpoint
 * Uses z-ai-web-dev-sdk for AI-powered responses about the Styra platform
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, conversationHistory } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Build system prompt for Styra AI assistant
    const systemPrompt = `You are Styra AI, the friendly and helpful assistant for the Styra platform - a global grooming marketplace where customers discover and book premium grooming services like haircuts, beard trims, spa treatments, manicures, pedicures, and more.

Your role:
- Help users find grooming services near them
- Explain how Styra works (booking, payments, reviews)
- Answer questions about account management and safety
- Assist with navigation of the platform
- Provide information about business partnerships
- Help with payment and subscription queries

Key information about Styra:
- Users can browse businesses, view services, and book appointments
- Payment is held in escrow until the service is completed
- Users can leave reviews after appointments
- Businesses can manage their services, staff, and availability
- The platform supports multiple currencies based on location
- Safety features include reporting, blocking, and insurance claims

Be friendly, concise, and helpful. Use a warm but professional tone. If you don't know something specific, guide the user to the appropriate help section or suggest contacting support at support@styra.app.`;

    // Build conversation messages for context
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory || []).slice(-10), // Keep last 10 messages for context
      { role: 'user', content: message.trim() },
    ];

    try {
      // Dynamic import to avoid issues in non-server environments
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();

      const completion = await zai.chat.completions.create({
        messages,
        temperature: 0.7,
        max_tokens: 500,
      });

      const aiMessage = completion.choices?.[0]?.message?.content;

      if (!aiMessage) {
        return successResponse({
          message: "I'm sorry, I couldn't generate a response. Please try again.",
        });
      }

      return successResponse({ message: aiMessage });
    } catch (aiError: unknown) {
      // Fallback: if z-ai-web-dev-sdk is not available, provide rule-based responses
      console.warn('[Styra AI] SDK not available, using fallback responses:', aiError);
      const fallbackResponse = getFallbackResponse(message.trim());
      return successResponse({ message: fallbackResponse });
    }
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Fallback response system when AI SDK is not available
 */
function getFallbackResponse(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('book') || lower.includes('appointment') || lower.includes('reserve')) {
    return "To book a service on Styra:\n\n1. Browse businesses on the marketplace\n2. Select a business and view their services\n3. Choose a service, date, and time\n4. Complete the payment\n\nYour payment is held securely in escrow until the service is completed. Would you like me to help you find a specific type of service?";
  }

  if (lower.includes('payment') || lower.includes('pay') || lower.includes('price') || lower.includes('cost')) {
    return "Styra supports multiple payment methods including credit/debit cards, mobile money (M-Pesa), and PayPal. Prices are displayed in your local currency. When you book, your payment is held in escrow until the service is completed, ensuring your money is safe.\n\nFor business owners, payouts are processed after service completion with a small platform commission.";
  }

  if (lower.includes('cancel') || lower.includes('refund')) {
    return "To cancel a booking:\n\n1. Go to your dashboard\n2. Find the booking you want to cancel\n3. Click 'Cancel Booking'\n\nRefund policies vary by business. If a cancellation is made within the business's cancellation window, you'll receive a full refund to your original payment method.";
  }

  if (lower.includes('business') || lower.includes('partner') || lower.includes('provider') || lower.includes('list')) {
    return "To list your business on Styra:\n\n1. Create an account or sign in\n2. Go to 'For Business' in the navigation\n3. Complete the provider onboarding form\n4. Submit your business details for verification\n5. Once approved, you can add services and manage bookings\n\nThere's a small commission on each transaction. Premium listings and advertising options are also available.";
  }

  if (lower.includes('safe') || lower.includes('report') || lower.includes('block') || lower.includes('insurance')) {
    return "Your safety is our priority at Styra. We offer:\n\n- **Report Issue**: Report businesses or users who violate our guidelines\n- **Block User**: Prevent specific users from interacting with you\n- **Insurance Claims**: File claims for damages during services\n- **Verified Businesses**: Look for the verified badge on business profiles\n\nVisit the Safety page for more details or contact support@styra.app.";
  }

  if (lower.includes('review') || lower.includes('rating')) {
    return "After completing a booking, you can leave a review:\n\n1. Go to your dashboard\n2. Find the completed booking\n3. Rate the service (1-5 stars)\n4. Write a detailed review\n\nYour honest reviews help other users find great services and help businesses improve.";
  }

  if (lower.includes('help') || lower.includes('support') || lower.includes('contact')) {
    return "We're here to help! You can:\n\n- **Chat with Styra AI**: Right here! I can answer most questions\n- **Email Support**: support@styra.app\n- **Help Center**: Visit our Support page for detailed guides\n- **Safety Concerns**: Use the Report feature for urgent issues\n\nOur support team typically responds within 24 hours.";
  }

  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey') || lower.includes('good')) {
    return "Hello! 👋 Welcome to Styra! I'm your AI assistant, here to help you with anything about our grooming marketplace.\n\nI can help you with:\n• Finding and booking services\n• Understanding how payments work\n• Business partnership inquiries\n• Account and safety questions\n\nWhat would you like to know?";
  }

  return "Thanks for your message! I'm Styra AI, your platform assistant. I can help with booking services, finding businesses, payment questions, account management, and more.\n\nFor specific help, try asking about:\n- How to book a service\n- Payment methods and pricing\n- Becoming a business partner\n- Safety and reporting\n- Cancellations and refunds\n\nOr contact our support team at support@styra.app for complex issues.";
}
