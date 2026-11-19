import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format.dart';
import '../../models/models.dart';
import '../../state/data.dart';
import '../../widgets/common.dart';

/// Customer "My bookings" or, with [asProvider], the business' incoming bookings.
class MyBookingsScreen extends ConsumerWidget {
  const MyBookingsScreen({super.key, this.asProvider = false});
  final bool asProvider;

  static bool _isUpcoming(Booking b) => isUpcomingStatus(b.status);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(bookingsProvider(null));
    return DefaultTabController(
      length: asProvider ? 3 : 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(asProvider ? 'Appointments' : 'My bookings'),
          bottom: TabBar(tabs: [
            if (asProvider) const Tab(text: 'Requests'),
            const Tab(text: 'Upcoming'),
            const Tab(text: 'Past'),
          ]),
        ),
        body: AsyncView(
          value: async,
          builder: (p) {
            Widget list(List<Booking> items, String empty) => RefreshIndicator(
                  onRefresh: () async => ref.invalidate(bookingsProvider),
                  child: items.isEmpty
                      ? EmptyState(icon: Icons.event_busy, title: empty)
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: items.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (_, i) => BookingTile(items[i], asProvider: asProvider),
                        ),
                );
            final sorted = [...p.items]..sort((a, b) => (a.when ?? DateTime(0)).compareTo(b.when ?? DateTime(0)));
            return TabBarView(children: [
              if (asProvider) list(sorted.where((b) => b.status == 'PENDING').toList(), 'No new booking requests'),
              list(sorted.where((b) => asProvider ? b.status != 'PENDING' && _isUpcoming(b) : _isUpcoming(b)).toList(), 'No upcoming bookings'),
              list(sorted.where((b) => !_isUpcoming(b)).toList().reversed.toList(), 'No past bookings'),
            ]);
          },
        ),
      ),
    );
  }
}

class BookingTile extends StatelessWidget {
  const BookingTile(this.b, {super.key, this.asProvider = false});
  final Booking b;
  final bool asProvider;
  @override
  Widget build(BuildContext context) => Card(
        child: ListTile(
          onTap: () => context.push('/booking/${b.id}'),
          leading: NetImage(b.businessLogo, width: 44, height: 44),
          title: Text(b.serviceName, style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text('${asProvider ? b.customerName : b.businessName}\n${shortDate(b.when)} · ${b.time}'),
          isThreeLine: true,
          trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
            StatusChip(b.status),
            const SizedBox(height: 6),
            Text(money(b.totalPrice), style: const TextStyle(fontWeight: FontWeight.w600)),
          ]),
        ),
      );
}
