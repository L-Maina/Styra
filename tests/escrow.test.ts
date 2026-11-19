// @ts-nocheck
/**
 * Escrow and verification tests. Run with: bun test
 *
 * They run the real escrow.ts and verification.ts against a small in-memory stand-in for
 * Prisma. It supports what those files use (where operators, increment/decrement, updateMany
 * counts, and transactions that roll back when the callback throws), so a lost race, a failed
 * release or a half-finished refund shows up here instead of in production.
 */
import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

type Row = Record<string, any>;

// ── In-memory database ─────────────────────────────────────────────────────

const TABLES = [
  'user', 'business', 'service', 'booking', 'payment', 'wallet',
  'platformTransaction', 'notification', 'dispute',
];
const DEFAULTS: Record<string, Row> = {
  wallet: { balance: 0, pendingBalance: 0, currency: 'KES' },
  platformTransaction: { currency: 'KES', status: 'COMPLETED' },
  notification: { isRead: false },
  dispute: { status: 'OPEN' },
};

let state: Record<string, Row[]> = {};
let seq = 0;
const logs: Row[] = [];
const hooks: { beforeUpdateMany?: (table: string, args: Row) => void } = {};

function reset() {
  state = Object.fromEntries(TABLES.map((name) => [name, []]));
  seq = 0;
  logs.length = 0;
  hooks.beforeUpdateMany = undefined;
}

function matches(row: Row, where?: Row): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, cond]: [string, any]) => {
    if (key === 'OR') return cond.some((w: Row) => matches(row, w));
    if (key === 'AND') return cond.every((w: Row) => matches(row, w));
    const value = row[key] ?? null;
    if (cond !== null && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('in' in cond && !cond.in.includes(value)) return false;
      if ('notIn' in cond && cond.notIn.includes(value)) return false;
      if ('gte' in cond && (value === null || !(value >= cond.gte))) return false;
      if ('lte' in cond && (value === null || !(value <= cond.lte))) return false;
      return true;
    }
    return value === cond;
  });
}

function applyData(row: Row, data: Row) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && !(value instanceof Date) && ('increment' in value || 'decrement' in value)) {
      row[key] = (row[key] ?? 0) + (value.increment ?? 0) - (value.decrement ?? 0);
    } else if (value !== undefined) {
      row[key] = value;
    }
  }
  row.updatedAt = new Date();
}

function shape(row: Row | undefined, args: Row = {}): Row | null {
  if (!row) return null;
  const out: Row = { ...row };
  const wanted = { ...(args.include ?? {}), ...(args.select ?? {}) };
  if (wanted.business) out.business = { ...state.business.find((b) => b.id === row.businessId) };
  if (wanted.service) out.service = state.service.find((s) => s.id === row.serviceId) ?? null;
  return out;
}

function table(name: string) {
  const rows = () => state[name];
  const find = (where?: Row) => rows().filter((r) => matches(r, where));
  const sorted = (list: Row[], orderBy?: Row) => {
    if (!orderBy) return list;
    const [[key, dir]] = Object.entries(orderBy);
    return [...list].sort((a, b) => (dir === 'desc' ? 1 : -1) * ((a[key] > b[key]) - (a[key] < b[key])));
  };
  const create = ({ data }: Row) => {
    const row = { ...(DEFAULTS[name] ?? {}), ...data, id: data.id ?? `${name}_${++seq}`, createdAt: new Date(1_700_000_000_000 + seq), updatedAt: new Date() };
    rows().push(row);
    return row;
  };
  return {
    findFirst: async (args: Row = {}) => shape(sorted(find(args.where), args.orderBy)[0], args),
    findUnique: async (args: Row) => shape(find(args.where)[0], args),
    findMany: async (args: Row = {}) => {
      const list = sorted(find(args.where), args.orderBy).slice(0, args.take ?? undefined);
      return list.map((r) => shape(r, args));
    },
    create: async (args: Row) => ({ ...create(args) }),
    update: async ({ where, data }: Row) => {
      const row = find(where)[0];
      if (!row) throw new Error(`${name} not found`);
      applyData(row, data);
      return { ...row };
    },
    updateMany: async (args: Row) => {
      hooks.beforeUpdateMany?.(name, args);
      const list = find(args.where);
      list.forEach((r) => applyData(r, args.data));
      return { count: list.length };
    },
    upsert: async ({ where, create: c, update: u }: Row) => {
      const row = find(where)[0];
      if (row) { applyData(row, u); return { ...row }; }
      return { ...create({ data: c }) };
    },
  };
}

const db: Row = Object.fromEntries(TABLES.map((name) => [name, table(name)]));
db.$transaction = async (fn: (tx: Row) => Promise<any>) => {
  const snapshot = structuredClone(state);
  try {
    return await fn(db);
  } catch (error) {
    state = snapshot; // roll everything back, like a failed database transaction
    throw error;
  }
};

mock.module('../src/lib/db', () => ({ db }));
mock.module('../src/lib/transaction-log', () => ({
  logTransaction: async (data: Row) => { logs.push(data); },
}));

const escrow = await import('../src/lib/escrow');
const verification = await import('../src/lib/verification');
const statuses = await import('../src/lib/booking-status');

// ── Fixtures ───────────────────────────────────────────────────────────────

const HOUR = 3_600_000;

function seed(booking: Row = {}) {
  state.user.push({ id: 'prov1', role: 'BUSINESS_OWNER' }, { id: 'cust1', role: 'CUSTOMER' }, { id: 'adm1', role: 'ADMIN' });
  state.business.push({ id: 'biz1', ownerId: 'prov1', name: 'Fresh Cuts' });
  state.service.push({ id: 'svc1', name: 'Haircut' });
  addBooking('bk1', 'pay1', booking);
}

function addBooking(id: string, paymentId: string, overrides: Row = {}) {
  state.booking.push({
    id, customerId: 'cust1', businessId: 'biz1', serviceId: 'svc1',
    status: 'COMPLETED', completedAt: new Date(Date.now() - 25 * HOUR), updatedAt: new Date(),
    ...overrides,
  });
  state.payment.push({
    id: paymentId, bookingId: id, status: 'completed', escrowStatus: 'held',
    method: 'mpesa', transactionRef: `txn_${paymentId}`, providerRef: 'MP123',
  });
}

const hold = (bookingId = 'bk1', paymentId = 'pay1') => escrow.holdInEscrow(bookingId, paymentId, 1000, 150);
const wallet = () => state.wallet.find((w) => w.userId === 'prov1');
const escrowRow = (bookingId = 'bk1') => state.platformTransaction.find((t) => t.bookingId === bookingId && t.type === 'ESCROW_HELD');
const booking = (id = 'bk1') => state.booking.find((b) => b.id === id);
const payment = (id = 'pay1') => state.payment.find((p) => p.id === id);
const count = (type: string) => state.platformTransaction.filter((t) => t.type === type).length;
const notified = (userId: string, title: string) => state.notification.some((n) => n.userId === userId && n.title.includes(title));

async function failure(promise: Promise<any>) {
  try { await promise; } catch (error) { return error; }
  throw new Error('Expected the call to fail');
}

beforeEach(() => {
  reset();
  spyOn(console, 'error').mockImplementation(() => {});
});

// ── Status helpers ─────────────────────────────────────────────────────────

describe('booking status helpers', () => {
  it('match old lowercase rows and new uppercase rows', () => {
    expect(statuses.isStatus('in_progress', 'IN_PROGRESS')).toBe(true);
    expect(statuses.isStatus('Completed', 'COMPLETED', 'VERIFIED')).toBe(true);
    expect(statuses.isStatus('cancelled', 'COMPLETED')).toBe(false);
    expect(statuses.statusVariants('PENDING', 'IN_PROGRESS')).toEqual(['PENDING', 'pending', 'IN_PROGRESS', 'in_progress']);
    expect(statuses.statusLabel('IN_PROGRESS')).toBe('in progress');
  });
});

// ── Escrow ─────────────────────────────────────────────────────────────────

describe('holdInEscrow', () => {
  it('holds the payment and credits the provider\'s pending balance', async () => {
    seed();
    const result = await hold();
    expect(result.providerAmount).toBe(850);
    expect(result.platformFee).toBe(150);
    expect(escrowRow().escrowStatus).toBe('HELD');
    expect(wallet().pendingBalance).toBe(850);
    expect(wallet().balance).toBe(0);
  });

  it('is idempotent for the same payment (webhook retries)', async () => {
    seed();
    await hold();
    await hold();
    expect(count('ESCROW_HELD')).toBe(1);
    expect(wallet().pendingBalance).toBe(850);
  });

  it('does not credit a second, different payment and alerts admins', async () => {
    seed();
    await hold();
    await hold('bk1', 'pay2');
    expect(wallet().pendingBalance).toBe(850);
    expect(notified('adm1', 'Duplicate payment')).toBe(true);
  });

  it('records a payment that arrives after cancellation as refunded, without crediting the provider', async () => {
    seed({ status: 'cancelled' });
    await hold();
    expect(escrowRow().escrowStatus).toBe('REFUNDED');
    expect(wallet().pendingBalance).toBe(0);
    expect(payment().status).toBe('refunded');
    expect(notified('adm1', 'cancelled booking')).toBe(true);
  });
});

describe('releaseFromEscrow', () => {
  it('moves pending to available in one step and records revenue once', async () => {
    seed();
    await hold();
    const result = await escrow.releaseFromEscrow('bk1', 'test');
    expect(result.releasedAmount).toBe(850);
    expect(wallet().pendingBalance).toBe(0);
    expect(wallet().balance).toBe(850);
    expect(escrowRow().escrowStatus).toBe('RELEASED');
    expect(payment().escrowStatus).toBe('released');
    expect(count('SERVICE_COMPLETED')).toBe(1);
    expect(logs.map((l) => l.type)).toEqual(expect.arrayContaining(['ESCROW_HELD', 'SERVICE_COMPLETED', 'PLATFORM_FEE']));
    expect(notified('prov1', 'Funds Released')).toBe(true);
  });

  it('does nothing the second time', async () => {
    seed();
    await hold();
    await escrow.releaseFromEscrow('bk1', 'first');
    await escrow.releaseFromEscrow('bk1', 'second');
    expect(wallet().balance).toBe(850);
    expect(count('SERVICE_COMPLETED')).toBe(1);
  });

  it('fails loudly and changes nothing when the wallet does not hold the money', async () => {
    seed();
    await hold();
    wallet().pendingBalance = 0; // as if an older version never credited it
    const error = await failure(escrow.releaseFromEscrow('bk1', 'test'));
    expect(error.escrowCode).toBe('INCONSISTENT');
    expect(escrowRow().escrowStatus).toBe('HELD');
    expect(count('SERVICE_COMPLETED')).toBe(0);
  });

  it('refuses to release money that was refunded', async () => {
    seed();
    await hold();
    await escrow.refundFromEscrow('bk1', 'test');
    const error = await failure(escrow.releaseFromEscrow('bk1', 'test'));
    expect(error.escrowCode).toBe('INVALID_STATE');
    expect(error.status).toBe(409);
  });

  it('stops when another request changed the escrow first', async () => {
    seed();
    await hold();
    hooks.beforeUpdateMany = (name) => {
      if (name === 'platformTransaction') escrowRow().escrowStatus = 'RELEASED';
    };
    const error = await failure(escrow.releaseFromEscrow('bk1', 'test'));
    expect(error.escrowCode).toBe('CONFLICT');
    expect(wallet().pendingBalance).toBe(850);
    expect(wallet().balance).toBe(0);
  });

  it('reports a booking with no escrow', async () => {
    seed();
    const error = await failure(escrow.releaseFromEscrow('bk1', 'test'));
    expect(error.escrowCode).toBe('NO_ESCROW');
  });
});

describe('refundFromEscrow', () => {
  it('removes the provider\'s pending share and alerts admins to send the money back', async () => {
    seed();
    await hold();
    const result = await escrow.refundFromEscrow('bk1', 'test');
    expect(result.refundAmount).toBe(1000);
    expect(escrowRow().escrowStatus).toBe('REFUNDED');
    expect(wallet().pendingBalance).toBe(0);
    expect(wallet().balance).toBe(0);
    expect(payment().status).toBe('refunded');
    const alert = state.notification.find((n) => n.userId === 'adm1' && n.title === 'Customer refund to send');
    expect(alert.message).toContain('KES 1000.00');
    expect(alert.message).toContain('MP123');
  });

  it('takes the money back from the available balance after a release', async () => {
    seed();
    await hold();
    await escrow.releaseFromEscrow('bk1', 'test');
    await escrow.refundFromEscrow('bk1', 'test');
    expect(wallet().balance).toBe(0);
    expect(escrowRow().escrowStatus).toBe('REFUNDED');
    expect(state.platformTransaction.find((t) => t.type === 'SERVICE_COMPLETED').status).toBe('REFUNDED');
    expect(notified('prov1', 'Payment Reversed')).toBe(true);
  });

  it('splits a payment: customer share refunded, the rest settled to the provider', async () => {
    seed();
    await hold();
    const result = await escrow.refundFromEscrow('bk1', 'split', { customerRefundAmount: 400 });
    expect(result.refundAmount).toBe(400);
    expect(wallet().pendingBalance).toBe(0);
    expect(wallet().balance).toBe(510); // 600 kept, minus 15% fee (90)
    expect(escrowRow()).toMatchObject({ escrowStatus: 'RELEASED', amount: 600, platformFee: 90, providerAmount: 510 });
    expect(state.platformTransaction.find((t) => t.type === 'REFUND')).toMatchObject({ amount: 400, providerAmount: -340 });
  });

  it('rejects a refund larger than the payment', async () => {
    seed();
    await hold();
    const error = await failure(escrow.refundFromEscrow('bk1', 'test', { customerRefundAmount: 5000 }));
    expect(error.escrowCode).toBe('INVALID_INPUT');
    expect(wallet().pendingBalance).toBe(850);
  });
});

describe('disputeEscrow', () => {
  it('freezes held money without moving it', async () => {
    seed();
    await hold();
    const first = await escrow.disputeEscrow('bk1');
    const second = await escrow.disputeEscrow('bk1');
    expect(first.alreadyDisputed).toBe(false);
    expect(second.alreadyDisputed).toBe(true);
    expect(escrowRow().escrowStatus).toBe('DISPUTED');
    expect(wallet().pendingBalance).toBe(850);
  });

  it('pulls released money back into pending', async () => {
    seed();
    await hold();
    await escrow.releaseFromEscrow('bk1', 'test');
    const result = await escrow.disputeEscrow('bk1');
    expect(result.pulledBack).toBe(true);
    expect(wallet().balance).toBe(0);
    expect(wallet().pendingBalance).toBe(850);
  });
});

// ── Verification ───────────────────────────────────────────────────────────

describe('markBookingCompleted', () => {
  it('starts the window, notifies the customer, and accepts older lowercase rows', async () => {
    seed({ status: 'in_progress', completedAt: null });
    const result = await verification.markBookingCompleted('bk1');
    expect(result.changed).toBe(true);
    expect(booking().status).toBe('COMPLETED');
    expect(booking().completedAt).toBeInstanceOf(Date);
    expect(Math.round((result.deadline.getTime() - Date.now()) / HOUR)).toBe(24);
    expect(state.notification.find((n) => n.userId === 'cust1').type).toBe('VERIFICATION_UPDATE');

    const again = await verification.markBookingCompleted('bk1');
    expect(again.changed).toBe(false);
  });

  it('refuses a booking that has not started', async () => {
    seed({ status: 'PENDING', completedAt: null });
    const error = await failure(verification.markBookingCompleted('bk1'));
    expect(error.status).toBe(409);
  });
});

describe('customerConfirm', () => {
  it('verifies the booking and pays the provider together', async () => {
    seed();
    await hold();
    const result = await verification.customerConfirm('bk1', 'cust1');
    expect(result.releasedAmount).toBe(850);
    expect(booking().status).toBe('VERIFIED');
    expect(wallet().balance).toBe(850);
    expect(escrowRow().escrowStatus).toBe('RELEASED');
  });

  it('works on older lowercase rows', async () => {
    seed({ status: 'completed' });
    await hold();
    await verification.customerConfirm('bk1', 'cust1');
    expect(booking().status).toBe('VERIFIED');
    expect(wallet().balance).toBe(850);
  });

  it('only lets the customer on the booking confirm', async () => {
    seed();
    await hold();
    const error = await failure(verification.customerConfirm('bk1', 'someone-else'));
    expect(error.status).toBe(403);
    expect(booking().status).toBe('COMPLETED');
  });

  it('leaves the booking COMPLETED when the money cannot be released', async () => {
    seed();
    await hold();
    await escrow.refundFromEscrow('bk1', 'test');
    const error = await failure(verification.customerConfirm('bk1', 'cust1'));
    expect(error.status).toBe(409);
    expect(booking().status).toBe('COMPLETED');
  });

  it('is harmless to call twice', async () => {
    seed();
    await hold();
    await verification.customerConfirm('bk1', 'cust1');
    const again = await verification.customerConfirm('bk1', 'cust1');
    expect(again.message).toBe('Booking already verified');
    expect(wallet().balance).toBe(850);
  });
});

describe('autoVerifyExpiredBookings', () => {
  it('verifies only bookings past the 24 hour window and repairs stuck payments', async () => {
    seed(); // bk1: completed 25h ago
    addBooking('bk2', 'pay2', { completedAt: new Date(Date.now() - 1 * HOUR) }); // still inside the window
    addBooking('bk3', 'pay3', { status: 'completed', completedAt: null, updatedAt: new Date(Date.now() - 30 * HOUR) }); // older row
    addBooking('bk4', 'pay4', { status: 'VERIFIED' }); // verified, but payment never released
    for (const [b, p] of [['bk1', 'pay1'], ['bk2', 'pay2'], ['bk3', 'pay3'], ['bk4', 'pay4']]) await hold(b, p);

    const result = await verification.autoVerifyExpiredBookings();

    expect(result).toMatchObject({ verifiedCount: 2, skippedCount: 0, repairedCount: 1, errors: [] });
    expect(booking('bk1').status).toBe('VERIFIED');
    expect(booking('bk2').status).toBe('COMPLETED');
    expect(booking('bk3').status).toBe('VERIFIED');
    expect(escrowRow('bk1').escrowStatus).toBe('RELEASED');
    expect(escrowRow('bk2').escrowStatus).toBe('HELD');
    expect(escrowRow('bk3').escrowStatus).toBe('RELEASED');
    expect(escrowRow('bk4').escrowStatus).toBe('RELEASED');
    expect(wallet().balance).toBe(850 * 3);
    expect(wallet().pendingBalance).toBe(850);
  });

  it('keeps going when one booking fails, and reports it', async () => {
    seed();
    addBooking('bk2', 'pay2');
    await hold('bk1', 'pay1');
    await hold('bk2', 'pay2');
    await escrow.refundFromEscrow('bk1', 'test'); // bk1 can no longer be released

    const result = await verification.autoVerifyExpiredBookings();

    expect(result.verifiedCount).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(booking('bk1').status).toBe('COMPLETED');
    expect(booking('bk2').status).toBe('VERIFIED');
  });
});

describe('disputes', () => {
  async function dispute() {
    seed();
    await hold();
    return (await verification.raiseDispute('bk1', 'cust1', 'The service was never provided.')).dispute;
  }

  it('freezes the booking and the payment, once per booking', async () => {
    const first = await dispute();
    expect(booking().status).toBe('DISPUTED');
    expect(escrowRow().escrowStatus).toBe('DISPUTED');
    expect(first.status).toBe('OPEN');

    const again = await verification.raiseDispute('bk1', 'cust1', 'The service was never provided.');
    expect(again.dispute.id).toBe(first.id);
    expect(state.dispute).toHaveLength(1);
  });

  it('pays the provider when resolved in their favour, and only once', async () => {
    const d = await dispute();
    await verification.resolveDispute(d.id, 'RELEASE_TO_PROVIDER', 'adm1', { notes: 'Photos show the work was done.' });
    expect(state.dispute[0].status).toBe('RESOLVED');
    expect(booking().status).toBe('VERIFIED');
    expect(escrowRow().escrowStatus).toBe('RELEASED');
    expect(wallet().balance).toBe(850);

    const again = await verification.resolveDispute(d.id, 'RELEASE_TO_PROVIDER', 'adm1');
    expect(again.message).toBe('Dispute already resolved');
    expect(wallet().balance).toBe(850);

    const second = await failure(verification.raiseDispute('bk1', 'cust1', 'Trying again after it was resolved.'));
    expect(second.status).toBe(409);
  });

  it('refunds the customer in full and cancels the booking', async () => {
    const d = await dispute();
    const result = await verification.resolveDispute(d.id, 'FULL_REFUND', 'adm1');
    expect(result.refundAmount).toBe(1000);
    expect(booking().status).toBe('CANCELLED');
    expect(escrowRow().escrowStatus).toBe('REFUNDED');
    expect(wallet()).toMatchObject({ balance: 0, pendingBalance: 0 });
  });

  it('splits 50/50 by default, or by the amount the admin chooses', async () => {
    const d = await dispute();
    const result = await verification.resolveDispute(d.id, 'PARTIAL_REFUND', 'adm1');
    expect(result.refundAmount).toBe(500);
    expect(booking().status).toBe('VERIFIED');
    expect(wallet()).toMatchObject({ balance: 425, pendingBalance: 0 }); // 500 kept, minus 15% fee

    reset();
    const d2 = await dispute();
    const custom = await verification.resolveDispute(d2.id, 'PARTIAL_REFUND', 'adm1', { customerRefundAmount: 700 });
    expect(custom.refundAmount).toBe(700);
    expect(wallet().balance).toBe(255); // 300 kept, minus 15% fee
  });

  it('pulls back money that was already released before the dispute', async () => {
    seed({ status: 'VERIFIED' });
    await hold();
    await escrow.releaseFromEscrow('bk1', 'test');
    const d = (await verification.raiseDispute('bk1', 'cust1', 'The service was never provided.')).dispute;
    expect(wallet()).toMatchObject({ balance: 0, pendingBalance: 850 });

    await verification.resolveDispute(d.id, 'FULL_REFUND', 'adm1');
    expect(wallet()).toMatchObject({ balance: 0, pendingBalance: 0 });
    expect(state.platformTransaction.find((t) => t.type === 'SERVICE_COMPLETED').status).toBe('REFUNDED');
  });

  it('rolls everything back if the money cannot move', async () => {
    const d = await dispute();
    wallet().pendingBalance = 0; // wallet does not hold the money
    const error = await failure(verification.resolveDispute(d.id, 'RELEASE_TO_PROVIDER', 'adm1'));
    expect(error.escrowCode).toBe('INCONSISTENT');
    expect(state.dispute[0].status).toBe('OPEN');
    expect(booking().status).toBe('DISPUTED');
    expect(escrowRow().escrowStatus).toBe('DISPUTED');
  });
});

describe('cancelBookingWithRefund', () => {
  it('cancels a paid booking and reverses the held payment', async () => {
    seed({ status: 'confirmed', completedAt: null });
    await hold();
    const result = await verification.cancelBookingWithRefund('bk1', 'Customer cancelled');
    expect(result.refundAmount).toBe(1000);
    expect(booking().status).toBe('CANCELLED');
    expect(escrowRow().escrowStatus).toBe('REFUNDED');
    expect(wallet().pendingBalance).toBe(0);
  });

  it('cancels an unpaid booking without touching money', async () => {
    seed({ status: 'PENDING', completedAt: null });
    const result = await verification.cancelBookingWithRefund('bk1', 'Customer cancelled');
    expect(result.refundAmount).toBe(0);
    expect(booking().status).toBe('CANCELLED');
  });

  it('refuses a booking that is already completed', async () => {
    seed();
    const error = await failure(verification.cancelBookingWithRefund('bk1', 'Too late'));
    expect(error.status).toBe(409);
    expect(booking().status).toBe('COMPLETED');
  });
});

describe('adminSettleEscrow', () => {
  it('sends admins to the dispute flow while a dispute is open', async () => {
    seed();
    await hold();
    await verification.raiseDispute('bk1', 'cust1', 'The service was never provided.');
    const error = await failure(verification.adminSettleEscrow('bk1', 'refund', 'manual'));
    expect(error.status).toBe(409);
    expect(escrowRow().escrowStatus).toBe('DISPUTED');
  });

  it('refunds and cancels, or verifies and releases', async () => {
    seed();
    await hold();
    const released = await verification.adminSettleEscrow('bk1', 'release', 'manual');
    expect(released).toMatchObject({ action: 'released', amount: 850 });
    expect(booking().status).toBe('VERIFIED');

    reset();
    seed();
    await hold();
    const refunded = await verification.adminSettleEscrow('bk1', 'refund', 'manual');
    expect(refunded).toMatchObject({ action: 'refunded', amount: 1000 });
    expect(booking().status).toBe('CANCELLED');
  });

  it('leaves the booking alone when there is no escrow to settle', async () => {
    seed();
    const error = await failure(verification.adminSettleEscrow('bk1', 'release', 'manual'));
    expect(error.escrowCode).toBe('NO_ESCROW');
    expect(booking().status).toBe('COMPLETED');
  });
});
