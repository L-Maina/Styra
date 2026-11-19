import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/format.dart';
import '../../models/models.dart';
import '../../state/data.dart';
import '../../widgets/common.dart';

class NotificationBell extends ConsumerWidget {
  const NotificationBell({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final n = ref.watch(unreadCountProvider).valueOrNull ?? 0;
    return IconButton(
      tooltip: 'Notifications',
      onPressed: () => context.push('/notifications').then((_) => ref.invalidate(unreadCountProvider)),
      icon: Badge(isLabelVisible: n > 0, label: Text(n > 99 ? '99+' : '$n'), child: const Icon(Icons.notifications_outlined)),
    );
  }
}

IconData _iconFor(String type) {
  if (type.contains('booking')) return Icons.event_note_outlined;
  if (type.contains('payment') || type.contains('payout')) return Icons.payments_outlined;
  if (type.contains('review')) return Icons.star_outline;
  if (type.contains('message') || type.contains('chat')) return Icons.chat_bubble_outline;
  if (type.contains('dispute')) return Icons.gavel_outlined;
  if (type.contains('verification')) return Icons.verified_outlined;
  return Icons.notifications_outlined;
}

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  void _open(BuildContext context, WidgetRef ref, AppNotification n) {
    if (!n.isRead) ref.read(apiProvider).patch('/notifications/${n.id}').then((_) => ref.invalidate(notificationsProvider)).ignore();
    final link = n.link ?? '';
    final m = RegExp(r'bookings?[/=]([A-Za-z0-9_-]+)').firstMatch(link);
    if (m != null) {
      context.push('/booking/${m[1]}');
    } else if (link.contains('chat') || link.contains('message')) {
      context.go('/');
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(notificationsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications'), actions: [
        IconButton(tooltip: 'Preferences', icon: const Icon(Icons.tune), onPressed: () => context.push('/notifications/preferences')),
        TextButton(
          onPressed: () async {
            if (await guard(context, () => ref.read(apiProvider).patch('/notifications'))) ref.invalidate(notificationsProvider);
          },
          child: const Text('Mark all read'),
        ),
      ]),
      body: AsyncView(
        value: async,
        onRefresh: () async => ref.invalidate(notificationsProvider),
        builder: (p) => p.items.isEmpty
            ? const EmptyState(icon: Icons.notifications_none, title: 'You\'re all caught up', message: 'Booking, payment and message updates show up here.')
            : ListView.separated(
                itemCount: p.items.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (_, i) {
                  final n = p.items[i];
                  return ListTile(
                    onTap: () => _open(context, ref, n),
                    leading: CircleAvatar(child: Icon(_iconFor(n.type), size: 20)),
                    title: Text(n.title, style: TextStyle(fontWeight: n.isRead ? FontWeight.normal : FontWeight.w700)),
                    subtitle: Text(n.message, maxLines: 2, overflow: TextOverflow.ellipsis),
                    trailing: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Text(timeAgo(n.createdAt), style: const TextStyle(fontSize: 11)),
                      if (!n.isRead) const Padding(padding: EdgeInsets.only(top: 6), child: CircleAvatar(radius: 4)),
                    ]),
                  );
                },
              ),
      ),
    );
  }
}

final _prefsProvider = FutureProvider.autoDispose<Json>((ref) async => asMap(await ref.watch(apiProvider).get('/notifications/preferences')));

class NotificationPreferencesScreen extends ConsumerStatefulWidget {
  const NotificationPreferencesScreen({super.key});
  @override
  ConsumerState<NotificationPreferencesScreen> createState() => _PrefsState();
}

class _PrefsState extends ConsumerState<NotificationPreferencesScreen> {
  Json? _prefs;

  static const _labels = {
    'email': 'Email notifications',
    'push': 'Push notifications',
    'sms': 'SMS notifications',
    'bookingReminders': 'Booking reminders',
    'bookingUpdates': 'Booking updates',
    'paymentUpdates': 'Payment updates',
    'messages': 'New messages',
    'promotions': 'Offers & promotions',
    'marketing': 'Marketing',
  };

  Future<void> _toggle(String key, bool v) async {
    setState(() => _prefs = {...?_prefs, key: v});
    final ok = await guard(context, () => ref.read(apiProvider).put('/notifications/preferences', _prefs));
    if (!ok && mounted) setState(() => _prefs = {...?_prefs, key: !v});
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_prefsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Notification preferences')),
      body: AsyncView(
        value: async,
        builder: (d) {
          final source = asMap(d['preferences']).isNotEmpty ? asMap(d['preferences']) : d;
          _prefs ??= {for (final e in source.entries) if (e.value is bool) e.key: e.value};
          final keys = _prefs!.keys.toList();
          if (keys.isEmpty) return const EmptyState(icon: Icons.tune, title: 'No preferences available');
          return ListView(children: [
            for (final k in keys)
              SwitchListTile(
                title: Text(_labels[k] ?? titleCase(k.replaceAllMapped(RegExp('([A-Z])'), (m) => ' ${m[1]}'))),
                value: _prefs![k] == true,
                onChanged: (v) => _toggle(k, v),
              ),
          ]);
        },
      ),
    );
  }
}
