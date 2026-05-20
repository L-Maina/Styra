import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { rateLimit } from '@/lib/rate-limit';

// Rate limit setup endpoint to prevent abuse
const setupRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5,
  message: 'Too many setup attempts. Please try again later.',
});

/**
 * Generate a random password.
 * Used instead of hardcoded 'password123' for demo accounts.
 */
function generateRandomPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

/**
 * POST /api/setup
 * 
 * One-time production setup endpoint.
 * Creates the admin user + demo data if they don't already exist.
 * 
 * SECURITY IMPROVEMENTS:
 *   - No hardcoded passwords — generates random ones per invocation
 *   - Passwords are NEVER returned in the response body
 *   - Rate limited to 5 attempts per hour
 *   - Only available in development mode
 *   - Requires SETUP_SECRET if set in environment
 */
export async function POST(request: NextRequest) {
  // Rate limit check
  const rateLimitResponse = await setupRateLimiter(request);
  if (rateLimitResponse) return rateLimitResponse;

  // Disable setup endpoint in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Setup is not available in production' },
      { status: 403 }
    );
  }

  try {
    // Check if setup key is required (optional security layer)
    const body = await request.json().catch(() => ({}));
    const setupKey = body.setupKey || request.headers.get('x-setup-key');

    // If SETUP_SECRET is set in env, require it
    if (process.env.SETUP_SECRET && setupKey !== process.env.SETUP_SECRET) {
      return NextResponse.json(
        { error: 'Invalid setup key' },
        { status: 403 }
      );
    }

    const results: Record<string, string> = {};
    const createdCredentials: Record<string, { email: string; passwordGenerated: boolean }> = {};

    // ── 1. Create Admin User ──────────────────────────────────
    const existingAdmin = await db.user.findUnique({
      where: { email: 'admin@styra.app' },
    });

    if (existingAdmin) {
      results.admin = `Admin user already exists (${existingAdmin.email})`;
    } else {
      const password = generateRandomPassword();
      const passwordHash = await bcrypt.hash(password, 12);
      const admin = await db.user.create({
        data: {
          email: 'admin@styra.app',
          password: passwordHash,
          name: 'Admin User',
          role: 'ADMIN',
          isVerified: true,
        },
      });
      results.admin = `Created admin user: ${admin.email}`;
      createdCredentials.admin = { email: admin.email, passwordGenerated: true };
      // Log the password to server console only (never to API response)
      console.log(`[Setup] Admin password: ${password} — SAVE THIS, it won't be shown again`);
    }

    // ── 2. Create Demo Business Owner ─────────────────────────
    const existingOwner = await db.user.findUnique({
      where: { email: 'jane@styleshop.co.ke' },
    });

    let businessOwner;
    if (existingOwner) {
      businessOwner = existingOwner;
      results.businessOwner = `Business owner already exists (${existingOwner.email})`;
    } else {
      const password = generateRandomPassword();
      const passwordHash = await bcrypt.hash(password, 12);
      businessOwner = await db.user.create({
        data: {
          email: 'jane@styleshop.co.ke',
          password: passwordHash,
          name: 'Jane Wanjiku',
          phone: '+254723456789',
          role: 'BUSINESS_OWNER',
          isVerified: true,
        },
      });
      results.businessOwner = `Created business owner: ${businessOwner.email}`;
      createdCredentials.businessOwner = { email: businessOwner.email, passwordGenerated: true };
      console.log(`[Setup] Business owner password: ${password} — SAVE THIS, it won't be shown again`);
    }

    // ── 3. Create Demo Customer ───────────────────────────────
    const existingCustomer = await db.user.findUnique({
      where: { email: 'john@example.com' },
    });

    let customer;
    if (existingCustomer) {
      customer = existingCustomer;
      results.customer = `Customer already exists (${existingCustomer.email})`;
    } else {
      const password = generateRandomPassword();
      const passwordHash = await bcrypt.hash(password, 12);
      customer = await db.user.create({
        data: {
          email: 'john@example.com',
          password: passwordHash,
          name: 'John Mwangi',
          phone: '+254712345678',
          role: 'CUSTOMER',
          isVerified: true,
        },
      });
      results.customer = `Created customer: ${customer.email}`;
      createdCredentials.customer = { email: customer.email, passwordGenerated: true };
      console.log(`[Setup] Customer password: ${password} — SAVE THIS, it won't be shown again`);
    }

    // ── 4. Create Demo Businesses ────────────────────────────
    const businessCount = await db.business.count();
    if (businessCount > 0) {
      results.businesses = `${businessCount} businesses already exist — skipping demo business creation`;
    } else {
      const b1 = await db.business.create({
        data: {
          ownerId: businessOwner!.id,
          name: 'Nairobi Style Hub',
          description: 'Premium barbershop offering classic and modern grooming services in the heart of Nairobi.',
          category: 'Barber Services',
          address: '123 Kenyatta Ave',
          city: 'Nairobi',
          country: 'Kenya',
          phone: '+254720000001',
          email: 'info@nairobistylehub.co.ke',
          rating: 4.8,
          reviewCount: 24,
          isVerified: true,
          isActive: true,
        },
      });

      const b2 = await db.business.create({
        data: {
          ownerId: businessOwner!.id,
          name: 'Glamour Studio',
          description: "Full-service salon specializing in women's haircuts, blowouts, and color treatments.",
          category: 'Haircuts & Styling',
          address: '456 Moi Avenue',
          city: 'Nairobi',
          country: 'Kenya',
          phone: '+254720000002',
          email: 'info@glamourstudio.co.ke',
          rating: 4.6,
          reviewCount: 18,
          isVerified: true,
          isActive: true,
        },
      });

      const b3 = await db.business.create({
        data: {
          ownerId: businessOwner!.id,
          name: 'The Grooming Lounge',
          description: 'Luxury grooming experience with premium products and skilled barbers.',
          category: 'Haircuts & Styling',
          address: '789 Uhuru Gardens',
          city: 'Nairobi',
          country: 'Kenya',
          phone: '+254720000003',
          email: 'info@thegroominglounge.co.ke',
          rating: 4.9,
          reviewCount: 31,
          isVerified: true,
          isActive: true,
        },
      });

      // Create services for each business
      await db.service.createMany({
        data: [
          { businessId: b1.id, name: 'Classic Cut', description: 'Traditional barber cut with styling', price: 500, duration: 30, category: 'Haircuts' },
          { businessId: b1.id, name: 'Beard Trim', description: 'Professional beard shaping and trimming', price: 300, duration: 20, category: 'Beard' },
          { businessId: b1.id, name: 'Full Grooming', description: 'Complete grooming package: haircut, beard trim, and facial', price: 800, duration: 60, category: 'Packages' },
          { businessId: b2.id, name: "Women's Cut", description: "Professional women's haircut and styling", price: 700, duration: 45, category: 'Haircuts' },
          { businessId: b2.id, name: 'Blowout', description: 'Professional blowout and styling', price: 500, duration: 30, category: 'Styling' },
          { businessId: b2.id, name: 'Color Treatment', description: 'Full hair color treatment with premium products', price: 2000, duration: 90, category: 'Color' },
          { businessId: b3.id, name: 'Premium Cut', description: 'Luxury haircut with premium products and consultation', price: 1000, duration: 45, category: 'Haircuts' },
          { businessId: b3.id, name: 'Hot Towel Shave', description: 'Traditional hot towel straight razor shave', price: 600, duration: 30, category: 'Shaves' },
          { businessId: b3.id, name: 'Hair Treatment', description: 'Deep conditioning hair treatment for healthy hair', price: 1500, duration: 60, category: 'Treatments' },
        ],
      });

      // Create staff for each business
      await db.staff.createMany({
        data: [
          { businessId: b1.id, name: 'James Otieno', role: 'Senior Barber', phone: '+254730000001', bio: "10+ years of experience in men's grooming" },
          { businessId: b1.id, name: 'Peter Kamau', role: 'Barber', phone: '+254730000002', bio: 'Specializes in fades and modern cuts' },
          { businessId: b2.id, name: 'Mary Akinyi', role: 'Senior Stylist', phone: '+254730000003', bio: "Expert in women's haircuts and color" },
          { businessId: b2.id, name: 'Grace Wambui', role: 'Stylist', phone: '+254730000004', bio: 'Blowout and styling specialist' },
          { businessId: b3.id, name: 'David Mwangi', role: 'Master Barber', phone: '+254730000005', bio: 'Award-winning barber with 15 years experience' },
          { businessId: b3.id, name: 'Samuel Kiprop', role: 'Barber', phone: '+254730000006', bio: 'Specialist in hot towel shaves and treatments' },
        ],
      });

      results.businesses = 'Created 3 demo businesses with 9 services and 6 staff members';
    }

    return NextResponse.json({
      success: true,
      message: 'Production setup complete!',
      // SECURITY: Passwords are NEVER included in the API response.
      // They are logged to the server console only.
      credentials: createdCredentials,
      instructions: {
        step1: 'Check the server console for generated passwords',
        step2: 'Go to the Sign In page',
        step3: 'Enter the email and generated password',
        step4: 'Click Sign In — you will be automatically redirected to the Admin Dashboard',
        note: 'You can change passwords after first login from the Admin Dashboard settings. Passwords are only shown once in the server logs.',
      },
      details: results,
    });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { 
        error: 'Setup failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Also support GET for easy browser testing
export async function GET() {
  return NextResponse.json({
    message: 'POST to /api/setup to seed admin user and demo data',
    usage: 'Send a POST request to this endpoint to run the setup',
    warning: 'This creates accounts with randomly generated passwords (shown in server logs only)',
  });
}
