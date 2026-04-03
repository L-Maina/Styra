import { NextResponse } from 'next/server';
import { successResponse, handleApiError } from '@/lib/api-utils';

export async function POST() {
  try {
    const response = successResponse({ message: 'Logged out successfully' });
    response.cookies.set('styra-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
