import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/format.dart';
import '../../models/models.dart';
import '../../state/auth.dart';
import '../../state/data.dart';
import '../../widgets/common.dart';
import '../payments/payment_sheet.dart';

class BookingDetailScreen extends ConsumerStatefulWidget {
  const BookingDetailScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<BookingDetailScreen> createState() => _BookingDetailState();
}

class _BookingDetailState extends ConsumerState<BookingDetailScreen> {
  bool _autoPayShown = false;

  void _refresh() {
    ref.invalidate(bookingProvider(widget.id));
    ref.invalidate(bookingsProvider);
  }

  Future<void> _act(Future<dynamic> Function(ApiClient api) f, String ok) async {
    if (await guard(context, () async => f(ref.read(apiProvider)), success: ok)) _refresh();
  }

  Future<void> _pay(Booking b) async {
    if (await showPaymentSheet(context, b)) _refresh();
  }

  /// POST /bookings/:id/confirm — releases escrow; rating is optional (creates a review).
  Future<void> _confirm(Booking b) async {
    int rating = 0;
    final comment = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => AlertDialog(
          title: const Text('Confirm the service'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('This releases the payment to the provider. Add a rating if you like.'),
            const SizedBox(height: 8),
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              for (var i = 1; i <= 5; i++)
                IconButton(
                  onPressed: () => set(() => rating = rating == i ? 0 : i),
                  icon: Icon(i <= rating ? Icons.star : Icons.star_border, color: const Color(0xFFFBBF24), size: 30),
                ),
            ]),
            if (rating > 0) TextField(controller: comment, maxLines: 3, maxLength: 2000, decoration: const InputDecoration(hintText: 'Comment (optional)')),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Confirm')),
          ],
        ),
      ),
    );
    if (ok != true) return;
    await _act(
      (api) => api.post('/bookings/${b.id}/confirm', {
        if (rating > 0) 'rating': rating,
        if (rating > 0 && comment.text.trim().isNotEmpty) 'comment': comment.text.trim(),
      }),
      'Thanks! The payment has been released to the provider.',
    );
  }

  Future<void> _review(Booking b) async {
    int rating = 5;
    final comment = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => AlertDialog(
          title: const Text('Rate your visit'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              for (var i = 1; i <= 5; i++)
                IconButton(
                  onPressed: () => set(() => rating = i),
                  icon: Icon(i <= rating ? Icons.star : Icons.star_border, color: const Color(0xFFFBBF24), size: 32),
                ),
            ]),
            TextField(controller: comment, maxLines: 3, decoration: const InputDecoration(hintText: 'Tell others about your experience')),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Submit')),
          ],
        ),
      ),
    );
    if (ok != true) return;
    await _act(
      (api) => api.post('/reviews', {'businessId': b.businessId, 'bookingId': b.id, 'rating': rating, if (comment.text.trim().isNotEmpty) 'comment': comment.text.trim()}),
      'Thanks for your review!',
    );
  }

  Future<void> _message(Booking b, bool asProvider) async {
    final otherId = asProvider ? b.customerId : b.businessOwnerId;
    if (otherId == null || otherId.isEmpty) return showError(context, 'Messaging is unavailable for this booking.');
    await guard(context, () async {
      final c = asMap(await ref.read(apiProvider).post('/conversations', {'otherUserId': otherId, 'businessId': b.businessId}));
      if (mounted) context.push('/chat/${c['id']}', extra: {'id': otherId, 'name': asProvider ? b.customerName : b.businessName});
    });
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(bookingProvider(widget.id));
    final me = ref.watch(currentUserProvider);
    final wantsPay = GoRouterState.of(context).uri.queryParameters['pay'] == '1';

    return Scaffold(
      appBar: AppBar(title: const Text('Booking')),
      body: AsyncView(
        value: async,
        onRefresh: () async => _refresh(),
        builder: (b) {
          final isCustomer = me?.id == b.customerId;
          // Admins can't change booking status (the API blocks them); only the owner runs the lifecycle.
          final isProvider = !isCustomer && me?.role == UserRole.businessOwner && (me?.businessId == null || me?.businessId == b.businessId);
          final s = b.status;
          final canPay = isCustomer && !b.isPaid && (s == 'PENDING' || s == 'CONFIRMED');
          final hoursUntil = b.when?.difference(DateTime.now()).inMinutes.toDouble();
          final cancelTooLate = isCustomer && hoursUntil != null && hoursUntil / 60 < 24;
          final deadline = s == 'COMPLETED' ? b.verificationDeadline : null;

          if (wantsPay && canPay && !_autoPayShown) {
            _autoPayShown = true;
            WidgetsBinding.instance.addPostFrameCallback((_) => _pay(b));
          }

          Widget patch(String label, String status, String ok, {bool filled = true}) {
            void onPressed() => _act((api) => api.patch('/bookings/${b.id}', {'status': status}), ok);
            return filled ? FilledButton(onPressed: onPressed, child: Text(label)) : OutlinedButton(onPressed: onPressed, child: Text(label));
          }

          final actions = <Widget>[
            if (canPay) FilledButton.icon(onPressed: () => _pay(b), icon: const Icon(Icons.payment), label: Text('Pay ${money(b.totalPrice)}')),
            // Provider lifecycle: PENDING → CONFIRMED → IN_PROGRESS → COMPLETED (starts the 24h window).
            if (isProvider && s == 'PENDING') patch('Accept booking', 'CONFIRMED', 'Booking confirmed'),
            if (isProvider && s == 'CONFIRMED') patch('Start service', 'IN_PROGRESS', 'Service started'),
            if (isProvider && s == 'IN_PROGRESS')
              patch('Mark as complete', 'COMPLETED', 'Marked as complete. The customer has 24 hours to confirm, then the payment is released to you.'),
            // Customer: confirm (releases escrow, optional rating) or report a problem — only while COMPLETED.
            if (isCustomer && s == 'COMPLETED') FilledButton.icon(onPressed: () => _confirm(b), icon: const Icon(Icons.verified_outlined), label: const Text('Confirm service')),
            if (isCustomer && s == 'COMPLETED')
              OutlinedButton.icon(
                onPressed: () async {
                  final reason = await promptText(context, title: 'Report a problem', hint: 'What went wrong? (at least 10 characters)', minLength: 10, maxLength: 2000);
                  if (reason != null) await _act((api) => api.post('/bookings/${b.id}/dispute', {'reason': reason}), 'Thanks. The payment stays on hold while our team reviews this.');
                },
                icon: const Icon(Icons.report_gmailerrorred_outlined),
                label: const Text('Report a problem'),
              ),
            if (isCustomer && s == 'VERIFIED' && !b.hasReview)
              OutlinedButton.icon(onPressed: () => _review(b), icon: const Icon(Icons.star_outline), label: const Text('Leave a review')),
            OutlinedButton.icon(onPressed: () => _message(b, isProvider), icon: const Icon(Icons.chat_bubble_outline), label: Text(isProvider ? 'Message customer' : 'Message business')),
            if (isCustomer) OutlinedButton.icon(onPressed: () => context.push('/claims/new?booking=${b.id}'), icon: const Icon(Icons.shield_outlined), label: const Text('File protection claim')),
            if ((isCustomer || isProvider) && isUpcomingStatus(s))
              cancelTooLate
                  ? const Text('Cancelling isn\'t possible less than 24 hours before the appointment. Contact support if you need help.', textAlign: TextAlign.center)
                  : TextButton(
                      onPressed: () async {
                        if (!await confirm(context, 'Cancel booking?', message: b.isPaid ? 'Any payment held in escrow is refunded.' : null, ok: 'Cancel booking', destructive: true)) return;
                        if (!context.mounted) return;
                        await guard(context, () async {
                          final api = ref.read(apiProvider);
                          final r = asMap(isProvider ? await api.patch('/bookings/${b.id}', {'status': 'CANCELLED'}) : await api.delete('/bookings/${b.id}'));
                          final refund = asDouble(r['refundAmount']);
                          if (context.mounted) showOk(context, refund > 0 ? 'Booking cancelled. ${money(refund)} refunded.' : 'Booking cancelled');
                          _refresh();
                        });
                      },
                      child: const Text('Cancel booking', style: TextStyle(color: Colors.redAccent)),
                    ),
          ];

          return ListView(padding: const EdgeInsets.all(16), children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    NetImage(b.businessLogo, width: 48, height: 48),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(b.serviceName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                        Text(isProvider ? b.customerName : b.businessName),
                      ]),
                    ),
                    StatusChip(s),
                  ]),
                  const Divider(height: 28),
                  _row(Icons.event, 'Date', longDate(b.when)),
                  _row(Icons.schedule, 'Time', '${b.time}${b.endTime != null ? ' – ${b.endTime}' : ''}'),
                  if (b.staffName != null) _row(Icons.person_outline, 'Stylist', b.staffName!),
                  _row(Icons.payments_outlined, 'Total', money(b.totalPrice)),
                  _row(Icons.account_balance_wallet_outlined, 'Payment', !b.isPaid ? 'Unpaid' : (s == 'VERIFIED' ? 'Released to provider' : (s == 'CANCELLED' ? 'Refunded' : 'Held in escrow'))),
                  if (isProvider && b.customerPhone != null) _row(Icons.phone_outlined, 'Phone', b.customerPhone!),
                  if ((b.notes ?? '').isNotEmpty) _row(Icons.notes, 'Notes', b.notes!),
                ]),
              ),
            ),
            if (deadline != null || s == 'DISPUTED' || s == 'VERIFIED') ...[
              const SizedBox(height: 12),
              Card(
                child: ListTile(
                  leading: Icon(s == 'DISPUTED' ? Icons.gavel_outlined : (s == 'VERIFIED' ? Icons.check_circle_outline : Icons.lock_clock)),
                  title: Text(s == 'DISPUTED'
                      ? 'Under review'
                      : s == 'VERIFIED'
                          ? 'Completed — payment released'
                          : (isCustomer ? 'Was everything OK?' : 'Waiting for the customer')),
                  subtitle: Text(s == 'DISPUTED'
                      ? 'The payment stays in escrow until our team decides.'
                      : s == 'VERIFIED'
                          ? 'The provider has been paid.'
                          : 'The payment is held in escrow. It is released when the customer confirms, or automatically ${dateTime(deadline)}.'),
                ),
              ),
            ],
            const SizedBox(height: 16),
            for (final a in actions) Padding(padding: const EdgeInsets.only(bottom: 10), child: a),
          ]);
        },
      ),
    );
  }

  Widget _row(IconData icon, String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, size: 18),
          const SizedBox(width: 10),
          SizedBox(width: 80, child: Text(label, style: const TextStyle(fontWeight: FontWeight.w500))),
          Expanded(child: Text(value)),
        ]),
      );
}
