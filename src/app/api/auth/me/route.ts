import { getSession } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { sanitizeUser } from '@/lib/response-sanitizer';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return errorResponse('Not authenticated', 401);
    }

    // session = { ...payload, user } where user is the full User record from DB
    const userData = session.user || session;
    return successResponse(
      sanitizeUser(userData as unknown as Record<string, unknown>)
    );
  } catch (error) {
    return handleApiError(error);
  }
}
