import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/design_tokens.dart';
import '../../core/format.dart';
import '../../models/models.dart';
import '../../widgets/common.dart';

final walletProvider = FutureProvider.autoDispose<Json>((ref) async => asMap(await ref.watch(apiProvider).get('/wallet')));

final transactionsProvider = FutureProvider.autoDispose<List<WalletTx>>((ref) async {
  final d = await ref.watch(apiProvider).get('/transactions', query: {'limit': 100});
  final m = asMap(d);
  return asList(d is List ? d : (m['transactions'] ?? m['data'])).map((e) => WalletTx(asMap(e))).toList();
});

class WalletScreen extends ConsumerWidget {
  const WalletScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(walletProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Wallet')),
      body: AsyncView(
        value: async,
        onRefresh: () async => ref.invalidate(walletProvider),
        builder: (d) {
          final w = asMap(d['wallet']);
          final txs = asList(d['recentTransactions']).map((e) => WalletTx(asMap(e))).toList();
          return ListView(padding: const EdgeInsets.all(16), children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(gradient: StyraTokens.brandGradient, borderRadius: BorderRadius.circular(StyraTokens.radiusLg)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Available balance', style: TextStyle(color: Colors.white70)),
                const SizedBox(height: 6),
                Text(money(asDouble(w['balance'])), style: const TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.w700)),
                const SizedBox(height: 16),
                Row(children: [
                  Expanded(child: _mini('Pending', money(asDouble(w['pendingBalance'])))),
                  Expanded(child: _mini('In escrow', money(asDouble(w['heldBalance'])))),
                ]),
              ]),
            ),
            SectionHeader('Recent activity', action: 'See all', onAction: () => context.push('/transactions')),
            if (txs.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('No transactions yet.')),
            for (final t in txs) TxTile(t),
          ]);
        },
      ),
    );
  }

  Widget _mini(String label, String value) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12)),
        Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
      ]);
}

class TxTile extends StatelessWidget {
  const TxTile(this.t, {super.key});
  final WalletTx t;
  @override
  Widget build(BuildContext context) => ListTile(
        contentPadding: EdgeInsets.zero,
        leading: CircleAvatar(
          backgroundColor: (t.isCredit ? StyraTokens.success : StyraTokens.destructive).withValues(alpha: 0.15),
          child: Icon(t.isCredit ? Icons.south_west : Icons.north_east, color: t.isCredit ? StyraTokens.success : StyraTokens.destructive, size: 18),
        ),
        title: Text(t.description ?? titleCase(t.type)),
        subtitle: Text('${dateTime(t.createdAt)}${t.status.isNotEmpty ? ' · ${titleCase(t.status)}' : ''}'),
        trailing: Text('${t.isCredit ? '+' : '−'}${money(t.amount.abs())}', style: TextStyle(fontWeight: FontWeight.w600, color: t.isCredit ? StyraTokens.success : null)),
      );
}

class TransactionsScreen extends ConsumerWidget {
  const TransactionsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(transactionsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Transactions')),
      body: AsyncView(
        value: async,
        onRefresh: () async => ref.invalidate(transactionsProvider),
        builder: (list) => list.isEmpty
            ? const EmptyState(icon: Icons.receipt_long_outlined, title: 'No transactions yet')
            : ListView(padding: const EdgeInsets.symmetric(horizontal: 16), children: [for (final t in list) TxTile(t)]),
      ),
    );
  }
}
