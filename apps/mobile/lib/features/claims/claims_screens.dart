import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/format.dart';
import '../../models/models.dart';
import '../../widgets/common.dart';

final claimsProvider = FutureProvider.autoDispose<List<Claim>>((ref) async {
  final d = await ref.watch(apiProvider).get('/claims');
  final m = asMap(d);
  return asList(d is List ? d : (m['claims'] ?? m['data'])).map((e) => Claim(asMap(e))).toList();
});

const claimTypes = {
  'service_dispute': 'Service dispute',
  'refund_request': 'Refund request',
  'quality_issue': 'Quality issue',
  'safety_concern': 'Safety concern',
  'billing_error': 'Billing error',
  'no_show': 'No-show',
  'damage': 'Damage',
  'payment_dispute': 'Payment dispute',
  'harassment': 'Harassment',
  'policy_violation': 'Policy violation',
  'other': 'Other',
};

class ClaimsScreen extends ConsumerWidget {
  const ClaimsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(claimsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Protection claims')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/claims/new').then((_) => ref.invalidate(claimsProvider)),
        icon: const Icon(Icons.add),
        label: const Text('New claim'),
      ),
      body: AsyncView(
        value: async,
        onRefresh: () async => ref.invalidate(claimsProvider),
        builder: (list) => list.isEmpty
            ? const EmptyState(icon: Icons.health_and_safety_outlined, title: 'No claims', message: 'Your Styra protection plan covers eligible issues with bookings.')
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                itemCount: list.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (_, i) => ClaimCard(list[i]),
              ),
      ),
    );
  }
}

class ClaimCard extends StatelessWidget {
  const ClaimCard(this.c, {super.key, this.trailing});
  final Claim c;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text('${claimTypes[c.type] ?? titleCase(c.type)} · #${c.number}', style: const TextStyle(fontWeight: FontWeight.w600))),
              StatusChip(c.status),
            ]),
            const SizedBox(height: 6),
            Text(c.description, maxLines: 3, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 6),
            Text('${money(c.amount)} · ${shortDate(c.submittedAt)}${c.customerName != null ? ' · ${c.customerName}' : ''}', style: const TextStyle(fontSize: 12)),
            if (c.resolution != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text('Resolution: ${c.resolution}', style: const TextStyle(fontStyle: FontStyle.italic))),
            if (trailing != null) Padding(padding: const EdgeInsets.only(top: 8), child: trailing!),
          ]),
        ),
      );
}

class NewClaimScreen extends ConsumerStatefulWidget {
  const NewClaimScreen({super.key, this.bookingId});
  final String? bookingId;
  @override
  ConsumerState<NewClaimScreen> createState() => _NewClaimState();
}

class _NewClaimState extends ConsumerState<NewClaimScreen> {
  String _type = 'service_dispute';
  final _desc = TextEditingController();
  final _amount = TextEditingController();
  DateTime? _incident;
  bool _busy = false;

  Future<void> _submit() async {
    final amount = double.tryParse(_amount.text.trim());
    if (_desc.text.trim().length < 10 || amount == null || amount <= 0) {
      return showError(context, 'Add a description (10+ characters) and a valid amount.');
    }
    setState(() => _busy = true);
    final ok = await guard(context, () => ref.read(apiProvider).post('/claims', {
          'type': _type,
          'description': _desc.text.trim(),
          'amount': amount,
          'currency': 'KES',
          if (widget.bookingId != null) 'bookingId': widget.bookingId,
          if (_incident != null) 'incidentDate': _incident!.toIso8601String(),
        }), success: 'Claim submitted');
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) context.pop();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('New protection claim')),
        body: ListView(padding: const EdgeInsets.all(16), children: [
          if (widget.bookingId != null) const Padding(padding: EdgeInsets.only(bottom: 12), child: Text('Linked to your booking.')),
          DropdownButtonFormField<String>(
            value: _type,
            decoration: const InputDecoration(labelText: 'Claim type'),
            items: [for (final e in claimTypes.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
            onChanged: (v) => setState(() => _type = v!),
          ),
          const SizedBox(height: 12),
          TextField(controller: _desc, maxLines: 5, decoration: const InputDecoration(labelText: 'What happened?')),
          const SizedBox(height: 12),
          TextField(controller: _amount, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Amount claimed (KES)')),
          const SizedBox(height: 12),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.event),
            title: Text(_incident == null ? 'Incident date (optional)' : longDate(_incident)),
            onTap: () async {
              final d = await showDatePicker(context: context, firstDate: DateTime.now().subtract(const Duration(days: 365)), lastDate: DateTime.now(), initialDate: DateTime.now());
              if (d != null) setState(() => _incident = d);
            },
          ),
          const SizedBox(height: 20),
          FilledButton(onPressed: _busy ? null : _submit, child: const Text('Submit claim')),
        ]),
      );
}
