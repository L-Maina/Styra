import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/design_tokens.dart';
import '../../core/format.dart';
import '../../models/models.dart';
import '../../widgets/common.dart';
import '../claims/claims_screens.dart';
import '../notifications/notifications_screen.dart';

/// Generic admin list loader: GET [path] and pull the list from [key] (or `data`).
final _adminList = FutureProvider.autoDispose.family<(List<Json>, Json), (String, String, String?)>((ref, args) async {
  final (path, key, status) = args;
  final d = await ref.watch(apiProvider).get(path, query: {'status': status, 'limit': 50});
  final m = asMap(d);
  final list = asList(d is List ? d : (m[key] ?? m['data'])).map(asMap).toList();
  return (list, asMap(m['stats']));
});

final _overviewProvider = FutureProvider.autoDispose<Json>((ref) async => asMap(await ref.watch(apiProvider).get('/admin/overview')));

class AdminDashboard extends StatelessWidget {
  const AdminDashboard({super.key});
  @override
  Widget build(BuildContext context) => DefaultTabController(
        length: 9,
        child: Scaffold(
          appBar: AppBar(
            title: const Text('Admin'),
            actions: const [NotificationBell()],
            bottom: const TabBar(isScrollable: true, tabAlignment: TabAlignment.start, tabs: [
              Tab(text: 'Overview'),
              Tab(text: 'Businesses'),
              Tab(text: 'Users'),
              Tab(text: 'Disputes'),
              Tab(text: 'Escrow'),
              Tab(text: 'Claims'),
              Tab(text: 'Support'),
              Tab(text: 'Reports'),
              Tab(text: 'Bans'),
            ]),
          ),
          body: const TabBarView(children: [
            _OverviewTab(),
            _BusinessesTab(),
            _UsersTab(),
            _DisputesTab(),
            _EscrowTab(),
            _ClaimsTab(),
            _TicketsTab(),
            _ReportsTab(),
            _BansTab(),
          ]),
        ),
      );
}

/// Filter chips + list for an admin collection.
class _AdminListView extends ConsumerStatefulWidget {
  const _AdminListView({required this.path, required this.listKey, required this.statuses, required this.itemBuilder, this.emptyIcon = Icons.inbox_outlined, this.emptyTitle = 'Nothing here'});
  final String path, listKey;
  final List<String> statuses;
  final Widget Function(BuildContext, WidgetRef, Json, VoidCallback refresh) itemBuilder;
  final IconData emptyIcon;
  final String emptyTitle;
  @override
  ConsumerState<_AdminListView> createState() => _AdminListViewState();
}

class _AdminListViewState extends ConsumerState<_AdminListView> with AutomaticKeepAliveClientMixin {
  String? _status;
  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final key = (widget.path, widget.listKey, _status);
    final async = ref.watch(_adminList(key));
    void refresh() => ref.invalidate(_adminList(key));
    return Column(children: [
      if (widget.statuses.isNotEmpty)
        SizedBox(
          height: 52,
          child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.fromLTRB(12, 8, 12, 4), children: [
            Padding(padding: const EdgeInsets.symmetric(horizontal: 4), child: ChoiceChip(label: const Text('All'), selected: _status == null, onSelected: (_) => setState(() => _status = null))),
            for (final s in widget.statuses)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: ChoiceChip(label: Text(titleCase(s)), selected: _status == s, onSelected: (_) => setState(() => _status = s)),
              ),
          ]),
        ),
      Expanded(
        child: AsyncView(
          value: async,
          onRefresh: () async => refresh(),
          builder: (r) => r.$1.isEmpty
              ? EmptyState(icon: widget.emptyIcon, title: widget.emptyTitle)
              : ListView.separated(
                  padding: const EdgeInsets.all(12),
                  itemCount: r.$1.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (ctx, i) => widget.itemBuilder(ctx, ref, r.$1[i], refresh),
                ),
        ),
      ),
    ]);
  }
}

Future<void> _call(BuildContext context, Future<dynamic> Function() f, VoidCallback refresh, String ok) async {
  if (await guard(context, () async => f(), success: ok)) refresh();
}

// ---------------- Overview ----------------
class _OverviewTab extends ConsumerWidget {
  const _OverviewTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_overviewProvider);
    return AsyncView(
      value: async,
      onRefresh: () async => ref.invalidate(_overviewProvider),
      builder: (d) {
        final s = asMap(d['stats']).isNotEmpty ? asMap(d['stats']) : d;
        String n(String k) => '${s[k] ?? 0}';
        return ListView(padding: const EdgeInsets.symmetric(vertical: 16), children: [
          StatGrid([
            StatTile(label: 'Users', value: n('totalUsers'), icon: Icons.people_outline),
            StatTile(label: 'Businesses', value: n('totalBusinesses'), icon: Icons.storefront_outlined, color: StyraTokens.secondary),
            StatTile(label: 'Bookings', value: n('totalBookings'), icon: Icons.event_note),
            StatTile(label: 'Revenue', value: money(asDouble(s['totalRevenue'])), icon: Icons.payments_outlined, color: StyraTokens.success),
            StatTile(label: 'This month', value: money(asDouble(s['monthlyRevenue'])), icon: Icons.trending_up, color: StyraTokens.success),
            StatTile(label: 'Pending applications', value: n('pendingApplications'), icon: Icons.hourglass_top, color: StyraTokens.warning),
            StatTile(label: 'Open disputes', value: n('openDisputes'), icon: Icons.gavel, color: StyraTokens.destructive),
            StatTile(label: 'Pending reports', value: n('pendingReports'), icon: Icons.flag_outlined, color: StyraTokens.warning),
            StatTile(label: 'Support tickets', value: n('pendingTickets'), icon: Icons.support_agent),
            StatTile(label: 'Active listings', value: n('activeListings'), icon: Icons.workspace_premium_outlined),
          ]),
        ]);
      },
    );
  }
}

// ---------------- Businesses ----------------
class _BusinessesTab extends StatelessWidget {
  const _BusinessesTab();
  @override
  Widget build(BuildContext context) => _AdminListView(
        path: '/admin/businesses',
        listKey: 'businesses',
        statuses: const ['PENDING', 'APPROVED', 'VERIFIED', 'REJECTED'],
        emptyIcon: Icons.storefront_outlined,
        emptyTitle: 'No businesses',
        itemBuilder: (ctx, ref, j, refresh) {
          final b = Business(j);
          final owner = asMap(j['owner']);
          final status = b.verificationStatus ?? (b.isVerified ? 'APPROVED' : 'PENDING');
          final approved = isBusinessApproved(status);
          Future<void> set(String v) async {
            // The API requires a reason when rejecting.
            final reason = v == 'APPROVED' ? null : await promptText(ctx, title: 'Reject ${b.name}', hint: 'Reason (shown to the owner)', minLength: 3);
            if (v == 'REJECTED' && reason == null) return;
            if (!ctx.mounted) return;
            await _call(ctx, () => ref.read(apiProvider).patch('/admin/businesses/${b.id}', {'verificationStatus': v, if (reason != null && reason.isNotEmpty) 'reason': reason}), refresh, 'Updated');
          }

          return Card(
            child: Column(children: [
              ListTile(
                leading: NetImage(b.logo, width: 44, height: 44),
                title: Text(b.name),
                subtitle: Text('${titleCase(b.category)} · ${b.city ?? ''}\nOwner: ${owner['name'] ?? '-'} (${owner['email'] ?? ''})'),
                isThreeLine: true,
                trailing: StatusChip(approved ? 'approved' : status),
                onTap: () => ctx.push('/business/${b.id}'),
              ),
              OverflowBar(alignment: MainAxisAlignment.end, children: [
                if (!approved) TextButton(onPressed: () => set('APPROVED'), child: const Text('Approve')),
                if (status != 'REJECTED') TextButton(onPressed: () => set('REJECTED'), child: const Text('Reject')),
              ]),
            ]),
          );
        },
      );
}

// ---------------- Users ----------------
class _UsersTab extends StatelessWidget {
  const _UsersTab();
  @override
  Widget build(BuildContext context) => _AdminListView(
        path: '/admin/users',
        listKey: 'users',
        statuses: const [],
        emptyIcon: Icons.people_outline,
        emptyTitle: 'No users',
        itemBuilder: (ctx, ref, j, refresh) {
          final u = AppUser(j);
          final banned = asBool(j['isBanned']);
          return Card(
            child: ListTile(
              leading: Avatar(url: u.avatar, name: u.name),
              title: Text(u.name),
              subtitle: Text('${u.email}\n${titleCase(asStr(j['role']) ?? '')} · joined ${shortDate(u.createdAt)}'),
              isThreeLine: true,
              trailing: PopupMenuButton<String>(
                icon: banned || j['isActive'] == false ? const Icon(Icons.block, color: StyraTokens.destructive) : null,
                onSelected: (v) async {
                  final api = ref.read(apiProvider);
                  if (v.startsWith('role:')) {
                    await _call(ctx, () => api.patch('/admin/users/${u.id}', {'role': v.substring(5)}), refresh, 'Role updated');
                  } else if (v == 'toggleActive') {
                    final active = j['isActive'] != false;
                    await _call(ctx, () => api.patch('/admin/users/${u.id}', {'isActive': !active}), refresh, active ? 'User deactivated' : 'User reactivated');
                  } else if (v == 'delete' && await confirm(ctx, 'Delete ${u.name}?', destructive: true, ok: 'Delete') && ctx.mounted) {
                    await _call(ctx, () => api.delete('/admin/users/${u.id}'), refresh, 'User deleted');
                  }
                },
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'role:CUSTOMER', child: Text('Make customer')),
                  PopupMenuItem(value: 'role:BUSINESS_OWNER', child: Text('Make business owner')),
                  PopupMenuItem(value: 'role:ADMIN', child: Text('Make admin')),
                  PopupMenuItem(value: 'toggleActive', child: Text('Deactivate / reactivate')),
                  PopupMenuItem(value: 'delete', child: Text('Delete user')),
                ],
              ),
            ),
          );
        },
      );
}

// ---------------- Disputes ----------------
class _DisputesTab extends StatelessWidget {
  const _DisputesTab();

  Future<void> _resolve(BuildContext ctx, WidgetRef ref, Dispute d, VoidCallback refresh) async {
    String action = 'RELEASE_TO_PROVIDER';
    final note = TextEditingController();
    final ok = await showDialog<bool>(
      context: ctx,
      builder: (c) => StatefulBuilder(
        builder: (c, set) => AlertDialog(
          title: const Text('Resolve dispute'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            for (final a in const {'RELEASE_TO_PROVIDER': 'Release to provider', 'FULL_REFUND': 'Full refund to customer', 'PARTIAL_REFUND': 'Partial refund'}.entries)
              RadioListTile<String>(value: a.key, groupValue: action, onChanged: (v) => set(() => action = v!), title: Text(a.value), contentPadding: EdgeInsets.zero),
            TextField(controller: note, maxLines: 3, decoration: const InputDecoration(hintText: 'Resolution notes (min 10 characters)')),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
            TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Resolve')),
          ],
        ),
      ),
    );
    if (ok != true || !ctx.mounted) return;
    if (note.text.trim().length < 10) return showError(ctx, 'Resolution notes must be at least 10 characters.');
    await _call(ctx, () => ref.read(apiProvider).post('/disputes/${d.id}/resolve', {'action': action, 'resolution': note.text.trim()}), refresh, 'Dispute resolved');
  }

  @override
  Widget build(BuildContext context) => _AdminListView(
        path: '/disputes',
        listKey: 'disputes',
        statuses: const ['OPEN', 'IN_PROGRESS', 'RESOLVED'],
        emptyIcon: Icons.gavel_outlined,
        emptyTitle: 'No disputes',
        itemBuilder: (ctx, ref, j, refresh) {
          final d = Dispute(j);
          final open = !d.status.toUpperCase().contains('RESOLVED');
          return Card(
            child: ListTile(
              title: Text(d.title),
              subtitle: Text('${d.reason}\n${money(d.amount)} · ${shortDate(d.createdAt)}', maxLines: 4, overflow: TextOverflow.ellipsis),
              isThreeLine: true,
              trailing: open ? FilledButton(style: FilledButton.styleFrom(minimumSize: const Size(80, 36)), onPressed: () => _resolve(ctx, ref, d, refresh), child: const Text('Resolve')) : StatusChip(d.status),
              onTap: d.bookingId == null ? null : () => ctx.push('/booking/${d.bookingId}'),
            ),
          );
        },
      );
}

// ---------------- Escrow ----------------
final _escrowProvider = FutureProvider.autoDispose<Json>((ref) async => asMap(await ref.watch(apiProvider).get('/admin/escrow', query: {'type': 'summary'})));

class _EscrowTab extends ConsumerWidget {
  const _EscrowTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_escrowProvider);
    return AsyncView(
      value: async,
      onRefresh: () async => ref.invalidate(_escrowProvider),
      builder: (d) {
        final s = asMap(d['summary']).isNotEmpty ? asMap(d['summary']) : d;
        final items = asList(d['transactions'] ?? d['held'] ?? d['payments']).map(asMap).toList();
        return ListView(padding: const EdgeInsets.symmetric(vertical: 16), children: [
          StatGrid([
            for (final e in s.entries.where((e) => e.value is num))
              StatTile(
                label: titleCase(e.key.replaceAllMapped(RegExp('([A-Z])'), (m) => ' ${m[1]}')),
                value: e.key.toLowerCase().contains('count') ? '${e.value}' : money(e.value as num),
                icon: Icons.lock_clock,
              ),
          ]),
          if (items.isNotEmpty) const SectionHeader('Escrow transactions'),
          for (final p in items)
            ListTile(
              title: Text(money(asDouble(p['amount']))),
              subtitle: Text('Booking ${p['bookingId'] ?? '-'} · ${dateTime(asDate(p['createdAt']))}'),
              trailing: PopupMenuButton<String>(
                onSelected: (a) async {
                  final reason = await promptText(context, title: a == 'release' ? 'Release funds' : 'Refund customer', hint: 'Reason');
                  if (reason == null || !context.mounted) return;
                  await _call(context, () => ref.read(apiProvider).post('/admin/escrow', {'bookingId': p['bookingId'], 'action': a, 'reason': reason}),
                      () => ref.invalidate(_escrowProvider), 'Done');
                },
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'release', child: Text('Release to provider')),
                  PopupMenuItem(value: 'refund', child: Text('Refund customer')),
                ],
              ),
              onTap: p['bookingId'] == null ? null : () => context.push('/booking/${p['bookingId']}'),
            ),
        ]);
      },
    );
  }
}

// ---------------- Claims ----------------
class _ClaimsTab extends StatelessWidget {
  const _ClaimsTab();
  @override
  Widget build(BuildContext context) => _AdminListView(
        path: '/admin/claims',
        listKey: 'claims',
        statuses: const ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PAID'],
        emptyIcon: Icons.health_and_safety_outlined,
        emptyTitle: 'No claims',
        itemBuilder: (ctx, ref, j, refresh) {
          final c = Claim(j);
          Future<void> set(String status) async {
            final resolution = status == 'UNDER_REVIEW' ? '' : await promptText(ctx, title: '${titleCase(status)} claim', hint: 'Resolution / notes');
            if (resolution == null || !ctx.mounted) return;
            await _call(ctx, () => ref.read(apiProvider).put('/admin/claims', {'claimId': c.id, 'status': status, if (resolution.isNotEmpty) 'resolution': resolution}), refresh, 'Claim updated');
          }

          return ClaimCard(
            c,
            trailing: OverflowBar(alignment: MainAxisAlignment.end, children: [
              if (c.status == 'SUBMITTED') TextButton(onPressed: () => set('UNDER_REVIEW'), child: const Text('Review')),
              if (c.status == 'SUBMITTED' || c.status == 'UNDER_REVIEW') ...[
                TextButton(onPressed: () => set('APPROVED'), child: const Text('Approve')),
                TextButton(onPressed: () => set('REJECTED'), child: const Text('Reject')),
              ],
              if (c.status == 'APPROVED') TextButton(onPressed: () => set('PAID'), child: const Text('Mark paid')),
            ]),
          );
        },
      );
}

// ---------------- Support tickets ----------------
class _TicketsTab extends StatelessWidget {
  const _TicketsTab();
  @override
  Widget build(BuildContext context) => _AdminListView(
        path: '/admin/tickets',
        listKey: 'tickets',
        statuses: const ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
        emptyIcon: Icons.support_agent,
        emptyTitle: 'No support tickets',
        itemBuilder: (ctx, ref, j, refresh) {
          final replies = asList(j['replies']).length;
          final status = asStr(j['status']) ?? 'OPEN';
          return Card(
            child: ListTile(
              title: Text(asStr(j['subject']) ?? 'Ticket'),
              subtitle: Text('${asStr(j['message'] ?? j['description']) ?? ''}\n${asStr(j['name'] ?? j['email']) ?? ''} · $replies replies · ${titleCase(asStr(j['priority']) ?? '')}',
                  maxLines: 4, overflow: TextOverflow.ellipsis),
              isThreeLine: true,
              trailing: PopupMenuButton<String>(
                child: StatusChip(status),
                onSelected: (v) async {
                  final api = ref.read(apiProvider);
                  if (v == 'reply') {
                    final reply = await promptText(ctx, title: 'Reply', hint: 'Your reply to the user');
                    if (reply != null && ctx.mounted) {
                      await _call(ctx, () => api.put('/admin/tickets', {'ticketId': j['id'], 'reply': reply, 'status': 'IN_PROGRESS', 'adminName': 'Styra Support'}), refresh, 'Reply sent');
                    }
                  } else {
                    await _call(ctx, () => api.put('/admin/tickets', {'ticketId': j['id'], 'status': v}), refresh, 'Ticket updated');
                  }
                },
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'reply', child: Text('Reply')),
                  PopupMenuItem(value: 'RESOLVED', child: Text('Mark resolved')),
                  PopupMenuItem(value: 'CLOSED', child: Text('Close')),
                ],
              ),
            ),
          );
        },
      );
}

// ---------------- Reports ----------------
class _ReportsTab extends StatelessWidget {
  const _ReportsTab();
  @override
  Widget build(BuildContext context) => _AdminListView(
        path: '/admin/reports',
        listKey: 'reports',
        statuses: const ['PENDING', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'],
        emptyIcon: Icons.flag_outlined,
        emptyTitle: 'No reports',
        itemBuilder: (ctx, ref, j, refresh) => Card(
          child: ListTile(
            title: Text('${titleCase(asStr(j['type']) ?? 'Report')}: ${asStr(j['targetName'] ?? j['reportedName'] ?? j['subject']) ?? ''}'),
            subtitle: Text(asStr(j['reason'] ?? j['description']) ?? '', maxLines: 3, overflow: TextOverflow.ellipsis),
            trailing: PopupMenuButton<String>(
              child: StatusChip(asStr(j['status']) ?? 'PENDING'),
              onSelected: (v) async {
                final parts = v.split(':');
                await _call(ctx, () => ref.read(apiProvider).put('/admin/reports', {'reportId': j['id'], 'status': parts[0], if (parts.length > 1) 'action': parts[1]}), refresh, 'Report updated');
              },
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'INVESTIGATING', child: Text('Investigate')),
                PopupMenuItem(value: 'RESOLVED:WARNING', child: Text('Resolve with warning')),
                PopupMenuItem(value: 'RESOLVED:SUSPENSION', child: Text('Suspend user')),
                PopupMenuItem(value: 'RESOLVED:BAN', child: Text('Ban user')),
                PopupMenuItem(value: 'DISMISSED', child: Text('Dismiss')),
              ],
            ),
          ),
        ),
      );
}

// ---------------- Bans ----------------
class _BansTab extends StatelessWidget {
  const _BansTab();
  @override
  Widget build(BuildContext context) => _AdminListView(
        path: '/admin/bans',
        listKey: 'bans',
        statuses: const ['PENDING'],
        emptyIcon: Icons.block,
        emptyTitle: 'No banned users',
        itemBuilder: (ctx, ref, j, refresh) {
          final appeal = asStr(j['appealStatus']);
          Future<void> act(String a) => _call(ctx, () => ref.read(apiProvider).put('/admin/bans', {'banId': j['id'], 'action': a}), refresh, 'Updated');
          return Card(
            child: Column(children: [
              ListTile(
                title: Text(asStr(j['userName'] ?? asMap(j['user'])['name'] ?? j['userEmail']) ?? 'User'),
                subtitle: Text([
                  asStr(j['reason']) ?? '',
                  asBool(j['isPermanent']) ? 'Permanent' : 'Until ${shortDate(asDate(j['endDate']))}',
                  if (appeal != null) 'Appeal: ${titleCase(appeal)} — ${asStr(j['appealReason']) ?? ''}',
                ].where((s) => s.isNotEmpty).join('\n')),
              ),
              OverflowBar(alignment: MainAxisAlignment.end, children: [
                if (appeal == 'PENDING') ...[
                  TextButton(onPressed: () => act('approveAppeal'), child: const Text('Approve appeal')),
                  TextButton(onPressed: () => act('rejectAppeal'), child: const Text('Reject appeal')),
                ],
                TextButton(onPressed: () => act('unblock'), child: const Text('Unblock')),
              ]),
            ]),
          );
        },
      );
}
