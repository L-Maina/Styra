import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/format.dart';
import '../../models/models.dart';
import '../../widgets/common.dart';

final disputesProvider = FutureProvider.autoDispose<Paged<Dispute>>((ref) => ref.watch(apiProvider).getPage('/disputes', Dispute.new, query: {'limit': 50}));

class DisputesScreen extends ConsumerWidget {
  const DisputesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(disputesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Disputes')),
      body: AsyncView(
        value: async,
        onRefresh: () async => ref.invalidate(disputesProvider),
        builder: (p) => p.items.isEmpty
            ? const EmptyState(
                icon: Icons.gavel_outlined,
                title: 'No disputes',
                message: 'If something goes wrong with a booking, open a dispute from the booking page. Payment stays in escrow until it\'s resolved.',
              )
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: p.items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (_, i) {
                  final d = p.items[i];
                  return Card(
                    child: ListTile(
                      onTap: d.bookingId == null ? null : () => context.push('/booking/${d.bookingId}'),
                      title: Text(d.title, style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(d.reason, maxLines: 2, overflow: TextOverflow.ellipsis),
                        if (d.resolution != null) Text('Resolution: ${d.resolution}', style: const TextStyle(fontStyle: FontStyle.italic)),
                        Text(shortDate(d.createdAt), style: const TextStyle(fontSize: 11)),
                      ]),
                      trailing: StatusChip(d.status),
                    ),
                  );
                },
              ),
      ),
    );
  }
}
