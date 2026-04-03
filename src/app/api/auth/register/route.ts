import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, generateToken, createOTP } from '@/lib/auth';
import { registerSchema } from '@/lib/validations';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = registerSchema.safeParse(body);
    if (!validated.success) {
      return errorResponse('Invalid registration data', 400);
    }

    const email = validated.data.email.toLowerCase();

    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return errorResponse(
        'Unable to create account. Please try a different email.',
        409
      );
    }

    if (validated.data.phone) {
      const existingPhone = await db.user.findFirst({
        where: { phone: validated.data.phone },
      });
      if (existingPhone) {
        return errorResponse('This phone number is already registered', 409);
      }
    }

    const hashedPassword = await hashPassword(validated.data.password);

    const user = await db.user.create({
      data: {
        email,
        name: validated.data.name,
        phone: validated.data.phone || null,
        password: hashedPassword,
        role: 'customer',
      },
    });

    // Generate OTP for phone verification
    let otpCode: string | null = null;
    if (validated.data.phone) {
      otpCode = await createOTP(user.id, email, validated.data.phone, 'phone_verification');
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    });

    const response = successResponse(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        // Return OTP code so the frontend can show it to the user
        // (no SMS provider configured — user enters it manually)
        otpCode,
      },
      201
    );

    response.cookies.set('styra-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
