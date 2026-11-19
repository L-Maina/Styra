import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/design_tokens.dart';
import '../../core/format.dart';
import '../../models/models.dart';

enum PayMethod {
  mpesa('MPESA', 'M-Pesa', Icons.phone_android),
  card('STRIPE', 'Card', Icons.credit_card),
  paypal('PAYPAL', 'PayPal', Icons.account_balance_wallet_outlined);

  const PayMethod(this.api, this.label, this.icon);
  final String api, label;
  final IconData icon;
}

/// Opens the payment sheet. Resolves to true when the payment completed.
Future<bool> showPaymentSheet(BuildContext context, Booking booking) async {
  final r = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    isDismissible: false,
    builder: (_) => _PaymentSheet(booking),
  );
  return r ?? false;
}

class _PaymentSheet extends ConsumerStatefulWidget {
  const _PaymentSheet(this.booking);
  final Booking booking;
  @override
  ConsumerState<_PaymentSheet> createState() => _PaymentSheetState();
}

class _PaymentSheetState extends ConsumerState<_PaymentSheet> {
  PayMethod _method = PayMethod.mpesa;
  String _phase = 'choose'; // choose | waiting | done | failed
  String? _error;
  bool _cancelled = false;

  static const _terminal = {'completed', 'failed', 'refunded', 'cancelled'};

  Future<void> _pay() async {
    final api = ref.read(apiProvider);
    setState(() {
      _phase = 'waiting';
      _error = null;
    });
    try {
      final res = asMap(await api.post('/payments', {'bookingId': widget.booking.id, 'paymentMethod': _method.api, 'currency': 'KES'}));
      final paymentId = res['paymentId']?.toString();
      // Card / PayPal providers may return a hosted checkout URL.
      final url = res['authorizationUrl'] ?? res['approvalUrl'] ?? res['checkoutUrl'] ?? res['redirectUrl'] ?? res['url'];
      if (url != null) await launchUrl(Uri.parse(url.toString()), mode: LaunchMode.externalApplication);
      if (res['devMode'] == 'true') return _finish('completed');
      if (paymentId == null) throw ApiException('Payment could not be started.');
      await _poll(paymentId);
    } catch (e) {
      if (mounted) setState(() {
        _phase = 'failed';
        _error = e.toString();
      });
    }
  }

  /// Polls every 3s for up to 2 minutes (matches the web client).
  Future<void> _poll(String id) async {
    final api = ref.read(apiProvider);
    for (var i = 0; i < 40 && !_cancelled && mounted; i++) {
      await Future<void>.delayed(const Duration(seconds: 3));
      try {
        final d = _method == PayMethod.mpesa
            ? asMap(await api.post('/payments/check-mpesa', {'paymentId': id}))
            : asMap(await api.get('/payments/$id'));
        final status = (asStr(d['status']) ?? asStr(asMap(d['payment'])['status']) ?? '').toLowerCase();
        if (_terminal.contains(status)) return _finish(status);
      } catch (_) {}
    }
    if (mounted && !_cancelled) {
      setState(() {
        _phase = 'failed';
        _error = 'We couldn\'t confirm the payment yet. Check your bookings in a few minutes.';
      });
    }
  }

  void _finish(String status) {
    if (!mounted) return;
    setState(() {
      _phase = status == 'completed' ? 'done' : 'failed';
      if (status != 'completed') _error = 'Payment ${status.toLowerCase()}.';
    });
  }

  @override
  Widget build(BuildContext context) {
    final b = widget.booking;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Pay for booking', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          Text('${b.serviceName} · ${b.businessName}'),
          const SizedBox(height: 4),
          Text(money(b.totalPrice), style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          const Row(children: [
            Icon(Icons.lock_outline, size: 14, color: StyraTokens.success),
            SizedBox(width: 4),
            Expanded(child: Text('Held securely in escrow until you confirm the service.', style: TextStyle(fontSize: 12))),
          ]),
          const SizedBox(height: 16),
          if (_phase == 'choose') ...[
            for (final m in PayMethod.values)
              Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: RadioListTile<PayMethod>(
                  value: m,
                  groupValue: _method,
                  onChanged: (v) => setState(() => _method = v!),
                  title: Text(m.label),
                  secondary: Icon(m.icon),
                  subtitle: m == PayMethod.mpesa ? const Text('You\'ll get a prompt on your phone') : null,
                ),
              ),
            const SizedBox(height: 8),
            FilledButton(onPressed: _pay, child: Text('Pay ${money(b.totalPrice)}')),
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Not now')),
          ],
          if (_phase == 'waiting') ...[
            const Center(child: CircularProgressIndicator()),
            const SizedBox(height: 16),
            Text(_method == PayMethod.mpesa ? 'Check your phone and enter your M-Pesa PIN…' : 'Waiting for payment confirmation…', textAlign: TextAlign.center),
            TextButton(
              onPressed: () {
                _cancelled = true;
                Navigator.pop(context, false);
              },
              child: const Text('Close'),
            ),
          ],
          if (_phase == 'done') ...[
            const Icon(Icons.check_circle, color: StyraTokens.success, size: 56),
            const SizedBox(height: 8),
            const Text('Payment received', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 16),
            FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Done')),
          ],
          if (_phase == 'failed') ...[
            const Icon(Icons.error_outline, color: StyraTokens.destructive, size: 56),
            const SizedBox(height: 8),
            Text(_error ?? 'Payment failed', textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(onPressed: () => setState(() => _phase = 'choose'), child: const Text('Try again')),
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Close')),
          ],
        ]),
      ),
    );
  }
}
