import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireAdmin } from '@/lib/auth';

// GET - Fetch all support tickets
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {};
    
    if (status && status !== 'all') {
      where.status = status;
    }
    
    if (priority && priority !== 'all') {
      where.priority = priority;
    }
    
    if (category && category !== 'all') {
      where.category = category;
    }

    const tickets = await db.supportTicket.findMany({
      where,
      include: {
        replies: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await db.supportTicket.count({ where });

    // Calculate stats
    const stats = {
      open: await db.supportTicket.count({ where: { status: 'OPEN' } }),
      inProgress: await db.supportTicket.count({ where: { status: 'IN_PROGRESS' } }),
      waiting: await db.supportTicket.count({ where: { status: 'WAITING' } }),
      resolved: await db.supportTicket.count({ where: { status: 'RESOLVED' } }),
      urgent: await db.supportTicket.count({ where: { priority: 'URGENT' } }),
    };

    return successResponse({
      tickets,
      total,
      stats,
      hasMore: offset + tickets.length < total,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST - Create a new support ticket
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const {
      userId,
      userName,
      userEmail,
      subject,
      message,
      category,
      priority,
    } = body;

    if (!userName || !userEmail || !subject || !message) {
      return errorResponse('Missing required fields', 400);
    }

    const ticket = await db.supportTicket.create({
      data: {
        userId,
        userName,
        userEmail,
        subject,
        message,
        category: category || 'GENERAL',
        priority: priority || 'MEDIUM',
        status: 'OPEN',
      },
    });

    return successResponse({ ticket }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT - Update ticket status/add reply
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { ticketId, status, assignedTo, reply, adminName } = body;

    if (!ticketId) {
      return errorResponse('Ticket ID is required', 400);
    }

    const updateData: Record<string, unknown> = {};
    
    if (status) {
      updateData.status = status;
    }
    
    if (assignedTo !== undefined) {
      updateData.assignedTo = assignedTo;
    }

    // Update ticket
    const ticket = await db.supportTicket.update({
      where: { id: ticketId },
      data: updateData,
    });

    // Add reply if provided
    if (reply && adminName) {
      await db.ticketReply.create({
        data: {
          ticketId,
          from: 'ADMIN',
          message: reply,
          adminName,
        },
      });
    }

    return successResponse({ ticket });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE - Close a ticket
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return errorResponse('Ticket ID is required', 400);
    }

    await db.supportTicket.update({
      where: { id },
      data: { status: 'CLOSED' },
    });

    return successResponse({ message: 'Ticket closed successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
