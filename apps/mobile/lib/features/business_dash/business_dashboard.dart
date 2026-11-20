import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/design_tokens.dart';
import '../../core/format.dart';
import '../../models/models.dart';
import '../../state/auth.dart';
import '../../state/data.dart';
import '../../widgets/common.dart';
import '../bookings/my_bookings_screen.dart';
import '../notifications/notifications_screen.dart';
import 'business_onboarding_screen.dart';

final _analyticsProvider = FutureProvider.autoDispose.family<Json, String>(
    (ref, id) async => asMap(await ref.watch(apiProvider).get('/analytics/business', query: {'businessId': id})));
final _payoutsProvider = FutureProvider.autoDispose<Json>((ref) async => asMap(await ref.watch(apiProvider).get('/payouts')));
final _promotionsProvider = FutureProvider.autoDispose.family<List<Json>, String>((ref, id) async {
  final d = await ref.watch(apiProvider).get('/promotions', query: {'businessId': id});
  final m = asMap(d);
  return asList(d is List ? d : (m['promotions'] ?? m['listings'] ?? m['data'])).map(asMap).toList();
});

class BusinessDashboard extends ConsumerWidget {
  const BusinessDashboard({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(myBusinessProvider);
    return async.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(
        appBar: AppBar(title: const Text('Dashboard')),
        body: EmptyState(icon: Icons.cloud_off, title: 'Couldn\'t load your business', message: '$e', action: FilledButton(onPressed: () => ref.invalidate(profileProvider), child: const Text('Retry'))),
      ),
      data: (b) => b == null
          ? Scaffold(
              appBar: AppBar(title: const Text('Dashboard')),
              body: EmptyState(
                icon: Icons.storefront_outlined,
                title: 'Set up your business',
                message: 'Add your business details to start receiving bookings.',
                action: FilledButton(onPressed: () => context.push('/onboarding/business').then((_) => ref.invalidate(profileProvider)), child: const Text('Get started')),
              ),
            )
          : _Dashboard(b),
    );
  }
}

class _Dashboard extends ConsumerWidget {
  const _Dashboard(this.b);
  final Business b;

  void _refresh(WidgetRef ref) {
    ref.invalidate(businessProvider(b.id));
    ref.invalidate(profileProvider);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) => DefaultTabController(
        length: 5,
        child: Scaffold(
          appBar: AppBar(
            title: Text(b.name),
            actions: [
              const NotificationBell(),
              IconButton(
                tooltip: 'Edit business',
                icon: const Icon(Icons.edit_outlined),
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => BusinessOnboardingScreen(existing: b))).then((_) => _refresh(ref)),
              ),
            ],
            bottom: const TabBar(isScrollable: true, tabAlignment: TabAlignment.start, tabs: [
              Tab(text: 'Overview'),
              Tab(text: 'Services'),
              Tab(text: 'Team'),
              Tab(text: 'Payouts'),
              Tab(text: 'Promote'),
            ]),
          ),
          body: TabBarView(children: [
            _Overview(b),
            _ServicesTab(b, onChanged: () => _refresh(ref)),
            _StaffTab(b, onChanged: () => _refresh(ref)),
            const _PayoutsTab(),
            _PromoteTab(b),
          ]),
        ),
      );
}

class _Overview extends ConsumerWidget {
  const _Overview(this.b);
  final Business b;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bookings = ref.watch(bookingsProvider(null)).valueOrNull?.items ?? const <Booking>[];
    final analytics = ref.watch(_analyticsProvider(b.id)).valueOrNull ?? const {};
    final today = isoDate(DateTime.now());
    final todays = bookings.where((x) => x.date.startsWith(today) && x.status != 'CANCELLED').toList();
    final pending = bookings.where((x) => x.status == 'PENDING').length;
    final earned = bookings.where((x) => x.status == 'VERIFIED').fold<double>(0, (s, x) => s + x.totalPrice);
    final popular = asList(analytics['popularServices']).map(asMap).toList();

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(bookingsProvider);
        ref.invalidate(_analyticsProvider(b.id));
      },
      child: ListView(padding: const EdgeInsets.only(top: 16, bottom: 32), children: [
        if (b.verificationStatus != null && !isBusinessApproved(b.verificationStatus))
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Card(child: ListTile(leading: const Icon(Icons.hourglass_top), title: Text(b.verificationStatus == 'REJECTED' ? 'Your business was not approved' : 'Waiting for approval'), subtitle: Text(ref.watch(currentUserProvider)?.rejectionReason ?? 'Admins review new businesses before they appear in search.'))),
          ),
        StatGrid([
          StatTile(label: 'Today', value: '${todays.length}', icon: Icons.today),
          StatTile(label: 'Pending requests', value: '$pending', icon: Icons.mark_email_unread_outlined, color: StyraTokens.warning),
          StatTile(label: 'Released to you', value: money(earned), icon: Icons.payments_outlined, color: StyraTokens.success),
          StatTile(label: 'Rating', value: '${b.rating.toStringAsFixed(1)} ★ (${b.reviewCount})', icon: Icons.star_outline, color: const Color(0xFFFBBF24)),
          if (analytics['pageViews'] != null) StatTile(label: 'Profile views', value: '${analytics['pageViews']}', icon: Icons.visibility_outlined, color: StyraTokens.secondary),
          StatTile(label: 'Services', value: '${b.services.length}', icon: Icons.content_cut),
        ]),
        const SectionHeader('Today\'s appointments'),
        if (todays.isEmpty) const Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: Text('Nothing scheduled today.')),
        for (final x in todays) Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 8), child: BookingTile(x, asProvider: true)),
        if (popular.isNotEmpty) ...[
          const SectionHeader('Popular services'),
          for (final p in popular.take(5))
            ListTile(title: Text(asStr(p['name'] ?? p['service']) ?? '-'), trailing: Text('${p['views'] ?? p['count'] ?? ''}')),
        ],
        Padding(
          padding: const EdgeInsets.all(16),
          child: OutlinedButton.icon(onPressed: () => context.push('/business/${b.id}'), icon: const Icon(Icons.storefront), label: const Text('View public profile')),
        ),
      ]),
    );
  }
}

// ---------------- Services ----------------
class _ServicesTab extends ConsumerWidget {
  const _ServicesTab(this.b, {required this.onChanged});
  final Business b;
  final VoidCallback onChanged;

  Future<void> _edit(BuildContext context, WidgetRef ref, [Service? s]) async {
    final name = TextEditingController(text: s?.name);
    final desc = TextEditingController(text: s?.description);
    final price = TextEditingController(text: s == null ? '' : s.price.toStringAsFixed(0));
    final dur = TextEditingController(text: '${s?.duration ?? 30}');
    final cat = TextEditingController(text: s?.category ?? b.category);
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(s == null ? 'New service' : 'Edit service', style: Theme.of(ctx).textTheme.titleLarge),
          const SizedBox(height: 12),
          TextField(controller: name, decoration: const InputDecoration(labelText: 'Name')),
          const SizedBox(height: 8),
          TextField(controller: desc, maxLines: 2, decoration: const InputDecoration(labelText: 'Description')),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: TextField(controller: price, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Price (KES)'))),
            const SizedBox(width: 8),
            Expanded(child: TextField(controller: dur, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Minutes'))),
          ]),
          const SizedBox(height: 8),
          TextField(controller: cat, decoration: const InputDecoration(labelText: 'Category')),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () async {
              final body = {
                'name': name.text.trim(),
                if (desc.text.trim().isNotEmpty) 'description': desc.text.trim(),
                'price': double.tryParse(price.text.trim()) ?? 0,
                'duration': int.tryParse(dur.text.trim()) ?? 30,
                'category': cat.text.trim().isEmpty ? 'general' : cat.text.trim(),
                if (s == null) 'businessId': b.id,
              };
              final ok = await guard(ctx, () => s == null ? ref.read(apiProvider).post('/services', body) : ref.read(apiProvider).patch('/services/${s.id}', body));
              if (ok && ctx.mounted) Navigator.pop(ctx, true);
            },
            child: const Text('Save'),
          ),
        ]),
      ),
    );
    if (saved == true) onChanged();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
        floatingActionButton: FloatingActionButton(onPressed: () => _edit(context, ref), child: const Icon(Icons.add)),
        body: b.services.isEmpty
            ? const EmptyState(icon: Icons.content_cut, title: 'No services yet', message: 'Add the services customers can book.')
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(0, 8, 0, 96),
                itemCount: b.services.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (_, i) {
                  final s = b.services[i];
                  return ListTile(
                    title: Text(s.name),
                    subtitle: Text('${duration(s.duration)} · ${money(s.price)}${s.isActive ? '' : ' · hidden'}'),
                    onTap: () => _edit(context, ref, s),
                    trailing: PopupMenuButton<String>(
                      onSelected: (v) async {
                        final api = ref.read(apiProvider);
                        final ok = v == 'toggle'
                            ? await guard(context, () => api.patch('/services/${s.id}', {'isActive': !s.isActive}))
                            : await confirm(context, 'Delete ${s.name}?', destructive: true, ok: 'Delete') && context.mounted && await guard(context, () => api.delete('/services/${s.id}'));
                        if (ok) onChanged();
                      },
                      itemBuilder: (_) => [
                        PopupMenuItem(value: 'toggle', child: Text(s.isActive ? 'Hide from customers' : 'Show to customers')),
                        const PopupMenuItem(value: 'delete', child: Text('Delete')),
                      ],
                    ),
                  );
                },
              ),
      );
}

// ---------------- Staff ----------------
class _StaffTab extends ConsumerWidget {
  const _StaffTab(this.b, {required this.onChanged});
  final Business b;
  final VoidCallback onChanged;

  Future<void> _edit(BuildContext context, WidgetRef ref, [Staff? s]) async {
    final name = TextEditingController(text: s?.name);
    final role = TextEditingController(text: s?.role ?? 'Stylist');
    final bio = TextEditingController(text: s?.bio);
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(s == null ? 'Add team member' : 'Edit team member', style: Theme.of(ctx).textTheme.titleLarge),
          const SizedBox(height: 12),
          TextField(controller: name, decoration: const InputDecoration(labelText: 'Name')),
          const SizedBox(height: 8),
          TextField(controller: role, decoration: const InputDecoration(labelText: 'Role')),
          const SizedBox(height: 8),
          TextField(controller: bio, maxLines: 2, decoration: const InputDecoration(labelText: 'Short bio')),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () async {
              final body = {
                'name': name.text.trim(),
                'role': role.text.trim(),
                if (bio.text.trim().isNotEmpty) 'bio': bio.text.trim(),
                if (s == null) 'businessId': b.id,
              };
              final ok = await guard(ctx, () => s == null ? ref.read(apiProvider).post('/staff', body) : ref.read(apiProvider).patch('/staff/${s.id}', body));
              if (ok && ctx.mounted) Navigator.pop(ctx, true);
            },
            child: const Text('Save'),
          ),
        ]),
      ),
    );
    if (saved == true) onChanged();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
        floatingActionButton: FloatingActionButton(onPressed: () => _edit(context, ref), child: const Icon(Icons.person_add_alt)),
        body: b.staff.isEmpty
            ? const EmptyState(icon: Icons.groups_outlined, title: 'No team members', message: 'Add stylists so customers can choose who they book with.')
            : ListView(padding: const EdgeInsets.fromLTRB(0, 8, 0, 96), children: [
                for (final s in b.staff)
                  ListTile(
                    leading: Avatar(url: s.avatar, name: s.name),
                    title: Text(s.name),
                    subtitle: Text('${s.role ?? ''}${s.isActive ? '' : ' · inactive'}'),
                    onTap: () => _edit(context, ref, s),
                    trailing: PopupMenuButton<String>(
                      onSelected: (v) async {
                        final api = ref.read(apiProvider);
                        final ok = v == 'toggle'
                            ? await guard(context, () => api.patch('/staff/${s.id}', {'isActive': !s.isActive}))
                            : await confirm(context, 'Remove ${s.name}?', destructive: true, ok: 'Remove') && context.mounted && await guard(context, () => api.delete('/staff/${s.id}'));
                        if (ok) onChanged();
                      },
                      itemBuilder: (_) => [
                        PopupMenuItem(value: 'toggle', child: Text(s.isActive ? 'Mark inactive' : 'Mark active')),
                        const PopupMenuItem(value: 'delete', child: Text('Remove')),
                      ],
                    ),
                  ),
              ]),
      );
}

// ---------------- Payouts ----------------
class _PayoutsTab extends ConsumerWidget {
  const _PayoutsTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_payoutsProvider);
    return AsyncView(
      value: async,
      onRefresh: () async => ref.invalidate(_payoutsProvider),
      builder: (d) {
        final w = asMap(d['wallet']);
        final payouts = asList(d['payouts']).map(asMap).toList();
        return ListView(padding: const EdgeInsets.all(16), children: [
          StatGrid([
            StatTile(label: 'Available', value: money(asDouble(w['balance'])), icon: Icons.account_balance_wallet_outlined, color: StyraTokens.success),
            StatTile(label: 'In escrow', value: money(asDouble(w['heldBalance'])), icon: Icons.lock_clock, color: StyraTokens.warning),
          ]),
          const SizedBox(height: 8),
          const Text('Funds are released from escrow after the customer confirms the service (or automatically after the review window). Payouts go to your M-Pesa or bank.',
              style: TextStyle(fontSize: 12)),
          const SectionHeader('Payout history'),
          if (payouts.isEmpty) const Text('No payouts yet.'),
          for (final p in payouts)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(money(asDouble(p['amount']))),
              subtitle: Text('${titleCase(asStr(p['method']) ?? '')} · ${dateTime(asDate(p['createdAt']))}${p['failedReason'] != null ? '\n${p['failedReason']}' : ''}'),
              trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                StatusChip(asStr(p['status']) ?? ''),
                if ((asStr(p['status']) ?? '').toLowerCase() == 'failed')
                  IconButton(
                    tooltip: 'Retry',
                    icon: const Icon(Icons.refresh),
                    onPressed: () async {
                      if (await guard(context, () => ref.read(apiProvider).post('/payouts/${p['id']}/retry'), success: 'Payout retried')) ref.invalidate(_payoutsProvider);
                    },
                  ),
              ]),
            ),
        ]);
      },
    );
  }
}

// ---------------- Promotions ----------------
class _PromoteTab extends ConsumerWidget {
  const _PromoteTab(this.b);
  final Business b;

  static const _plans = [
    ('featured', 'Featured listing', 'Top of search & home page', 7, 1500.0),
    ('featured', 'Featured listing', 'Top of search & home page', 30, 5000.0),
    ('boost', 'Search boost', 'Rank higher in your category', 7, 800.0),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_promotionsProvider(b.id));
    return ListView(padding: const EdgeInsets.all(16), children: [
      const Text('Get more bookings by promoting your business.'),
      const SizedBox(height: 12),
      for (final p in _plans)
        Card(
          margin: const EdgeInsets.only(bottom: 10),
          child: ListTile(
            title: Text('${p.$2} · ${p.$4} days'),
            subtitle: Text(p.$3),
            trailing: FilledButton(
              style: FilledButton.styleFrom(minimumSize: const Size(90, 40)),
              onPressed: () async {
                if (!await confirm(context, 'Buy ${p.$2}?', message: '${p.$4} days for ${money(p.$5)}')) return;
                if (!context.mounted) return;
                if (await guard(context, () => ref.read(apiProvider).post('/promotions', {
                      'businessId': b.id,
                      'promotionType': p.$1,
                      'duration': p.$4,
                      'price': p.$5,
                      'paymentMethod': 'MPESA',
                    }), success: 'Promotion requested')) {
                  ref.invalidate(_promotionsProvider(b.id));
                }
              },
              child: Text(money(p.$5)),
            ),
          ),
        ),
      const SectionHeader('Your promotions'),
      async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Text('$e'),
        data: (list) => list.isEmpty
            ? const Text('No active promotions.')
            : Column(children: [
                for (final p in list)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(titleCase(asStr(p['promotionType'] ?? p['plan'] ?? p['type']) ?? 'Promotion')),
                    subtitle: Text('Ends ${shortDate(asDate(p['endDate']))}'),
                    trailing: StatusChip(asStr(p['status']) ?? ''),
                  ),
              ]),
      ),
    ]);
  }
}
