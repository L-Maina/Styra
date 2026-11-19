import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/design_tokens.dart';
import '../../core/format.dart';
import '../../main.dart';
import '../../models/models.dart';
import '../../state/auth.dart';
import '../../widgets/common.dart';
import '../auth/auth_screens.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final u = ref.watch(currentUserProvider);
    if (u == null) return const SizedBox.shrink();
    final mode = ref.watch(themeModeProvider);
    final isCustomer = u.role == UserRole.customer;
    final isOwner = u.role == UserRole.businessOwner;

    Widget item(IconData icon, String title, String route, {String? subtitle}) => ListTile(
          leading: Icon(icon),
          title: Text(title),
          subtitle: subtitle == null ? null : Text(subtitle),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => context.push(route),
        );

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            Avatar(url: u.avatar, name: u.name, size: 64),
            const SizedBox(width: 16),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(u.name, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
                Text(u.email),
                const SizedBox(height: 4),
                Wrap(spacing: 6, children: [
                  StatusChip(u.role == UserRole.admin ? 'admin' : (isOwner ? 'provider' : 'customer')),
                  if (u.isVerified) const StatusChip('email verified'),
                ]),
              ]),
            ),
            IconButton(onPressed: () => context.push('/profile/edit'), icon: const Icon(Icons.edit_outlined)),
          ]),
        ),
        const VerifyEmailBanner(),
        const _Group('Account'),
        item(Icons.account_balance_wallet_outlined, 'Wallet', '/wallet'),
        item(Icons.receipt_long_outlined, 'Transactions', '/transactions'),
        item(Icons.notifications_outlined, 'Notifications', '/notifications'),
        item(Icons.tune, 'Notification preferences', '/notifications/preferences'),
        const _Group('Trust & safety'),
        if (isCustomer) item(Icons.shield_outlined, 'Protection plan', '/protection', subtitle: titleCase(u.protectionPlan)),
        item(Icons.gavel_outlined, 'Disputes', '/disputes'),
        item(Icons.health_and_safety_outlined, 'Protection claims', '/claims'),
        if (isCustomer) ...[
          const _Group('Grow with Styra'),
          item(Icons.storefront_outlined, 'List your business', '/onboarding/business'),
        ],
        const _Group('App'),
        ListTile(
          leading: const Icon(Icons.dark_mode_outlined),
          title: const Text('Dark mode'),
          trailing: Switch(
            value: mode == ThemeMode.dark,
            onChanged: (v) => ref.read(themeModeProvider.notifier).state = v ? ThemeMode.dark : ThemeMode.light,
          ),
        ),
        item(Icons.support_agent_outlined, 'Help & support', '/support'),
        ListTile(
          leading: const Icon(Icons.logout),
          title: const Text('Sign out'),
          onTap: () => ref.read(authProvider.notifier).logout(),
        ),
        ListTile(
          leading: const Icon(Icons.devices_other),
          title: const Text('Sign out of all devices'),
          onTap: () async {
            if (await confirm(context, 'Sign out everywhere?')) ref.read(authProvider.notifier).logout(allDevices: true);
          },
        ),
        ListTile(
          leading: const Icon(Icons.delete_outline, color: StyraTokens.destructive),
          title: const Text('Delete account', style: TextStyle(color: StyraTokens.destructive)),
          onTap: () async {
            if (!await confirm(context, 'Delete your account?', message: 'This permanently removes your data and cannot be undone.', ok: 'Delete', destructive: true)) return;
            if (!context.mounted) return;
            if (await guard(context, () => ref.read(apiProvider).delete('/users'))) ref.read(authProvider.notifier).logout();
          },
        ),
        const SizedBox(height: 32),
      ]),
    );
  }
}

class _Group extends StatelessWidget {
  const _Group(this.label);
  final String label;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 4),
        child: Text(label.toUpperCase(), style: TextStyle(fontSize: 12, letterSpacing: 0.8, fontWeight: FontWeight.w600, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.55))),
      );
}

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});
  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileState();
}

class _EditProfileState extends ConsumerState<EditProfileScreen> {
  late final AppUser _u = ref.read(currentUserProvider)!;
  late final _name = TextEditingController(text: _u.name);
  late final _phone = TextEditingController(text: _u.phone);
  late final _avatar = TextEditingController(text: _u.avatar);
  bool _busy = false;

  Future<void> _save() async {
    setState(() => _busy = true);
    final ok = await guard(context, () async {
      await ref.read(apiProvider).patch('/users', {
        'name': _name.text.trim(),
        if (_phone.text.trim().isNotEmpty) 'phone': _phone.text.trim(),
        if (_avatar.text.trim().isNotEmpty) 'avatar': _avatar.text.trim(),
      });
      await ref.read(authProvider.notifier).reloadUser();
    }, success: 'Profile updated');
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) context.pop();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Edit profile')),
        body: ListView(padding: const EdgeInsets.all(16), children: [
          Center(child: Avatar(url: _avatar.text, name: _name.text, size: 88)),
          const SizedBox(height: 20),
          TextField(controller: _name, decoration: const InputDecoration(labelText: 'Full name')),
          const SizedBox(height: 12),
          TextField(controller: _phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone', hintText: '+254712345678')),
          const SizedBox(height: 12),
          TextField(controller: _avatar, keyboardType: TextInputType.url, decoration: const InputDecoration(labelText: 'Avatar image URL'), onChanged: (_) => setState(() {})),
          const SizedBox(height: 24),
          FilledButton(onPressed: _busy ? null : _save, child: const Text('Save changes')),
        ]),
      );
}

final _planProvider = FutureProvider.autoDispose<Json>((ref) async => asMap(await ref.watch(apiProvider).get('/protection-plan')));

class ProtectionPlanScreen extends ConsumerWidget {
  const ProtectionPlanScreen({super.key});

  static const _fallback = [
    {'id': 'basic', 'name': 'Basic', 'price': 0, 'coverage': 'Standard booking protection'},
    {'id': 'enhanced', 'name': 'Enhanced', 'price': 299, 'coverage': 'Higher claim limits and faster review'},
    {'id': 'premium', 'name': 'Premium', 'price': 599, 'coverage': 'Maximum coverage and priority support'},
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_planProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Protection plan')),
      body: AsyncView(
        value: async,
        onRefresh: () async => ref.invalidate(_planProvider),
        builder: (d) {
          final current = (asStr(d['currentPlan'] ?? d['plan'] ?? asMap(d['current'])['id']) ?? ref.read(currentUserProvider)?.protectionPlan ?? 'basic').toLowerCase();
          final rawPlans = asList(d['plans'] ?? d['availablePlans']);
          final plans = rawPlans.isEmpty ? _fallback.map(asMap).toList() : rawPlans.map(asMap).toList();
          return ListView(padding: const EdgeInsets.all(16), children: [
            const Text('Every Styra booking is protected. Upgrade for higher claim limits.'),
            const SizedBox(height: 16),
            for (final p in plans)
              Card(
                margin: const EdgeInsets.only(bottom: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(StyraTokens.radius),
                  side: BorderSide(color: (asStr(p['id'] ?? p['key']) ?? '').toLowerCase() == current ? StyraTokens.primary : Theme.of(context).dividerColor, width: 1.5),
                ),
                child: ListTile(
                  contentPadding: const EdgeInsets.all(16),
                  title: Text(asStr(p['name']) ?? titleCase(asStr(p['id']) ?? ''), style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text([
                    asStr(p['coverage'] ?? p['description']) ?? '',
                    if (p['maxCoverage'] != null) 'Up to ${money(asDouble(p['maxCoverage']))} per claim',
                  ].where((s) => s.isNotEmpty).join('\n')),
                  trailing: (asStr(p['id'] ?? p['key']) ?? '').toLowerCase() == current
                      ? const StatusChip('current')
                      : FilledButton(
                          style: FilledButton.styleFrom(minimumSize: const Size(80, 40)),
                          onPressed: () async {
                            final id = (asStr(p['id'] ?? p['key']) ?? '').toLowerCase();
                            if (await guard(context, () => ref.read(apiProvider).patch('/protection-plan', {'plan': id}), success: 'Plan updated')) {
                              ref.invalidate(_planProvider);
                              ref.read(authProvider.notifier).reloadUser().ignore();
                            }
                          },
                          child: Text(asDouble(p['price']) == 0 ? 'Switch' : money(asDouble(p['price']))),
                        ),
                ),
              ),
          ]);
        },
      ),
    );
  }
}

class SupportScreen extends ConsumerStatefulWidget {
  const SupportScreen({super.key});
  @override
  ConsumerState<SupportScreen> createState() => _SupportState();
}

class _SupportState extends ConsumerState<SupportScreen> {
  final _subject = TextEditingController();
  final _message = TextEditingController();
  String _type = 'SUPPORT';
  bool _busy = false;

  Future<void> _send() async {
    final u = ref.read(currentUserProvider);
    if (_message.text.trim().length < 10) return showError(context, 'Please describe the issue (at least 10 characters).');
    setState(() => _busy = true);
    final ok = await guard(context, () => ref.read(apiProvider).post('/submissions', {
          'type': _type,
          'name': u?.name,
          'email': u?.email,
          'phone': u?.phone,
          'subject': _subject.text.trim(),
          'message': _message.text.trim(),
        }), success: 'Thanks — our team will get back to you.');
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) context.pop();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Help & support')),
        body: ListView(padding: const EdgeInsets.all(16), children: [
          DropdownButtonFormField<String>(
            value: _type,
            decoration: const InputDecoration(labelText: 'Topic'),
            items: const [
              DropdownMenuItem(value: 'SUPPORT', child: Text('Get help')),
              DropdownMenuItem(value: 'FEEDBACK', child: Text('Feedback')),
              DropdownMenuItem(value: 'REPORT', child: Text('Report a user or business')),
              DropdownMenuItem(value: 'PARTNERSHIP', child: Text('Partnerships')),
              DropdownMenuItem(value: 'OTHER', child: Text('Other')),
            ],
            onChanged: (v) => setState(() => _type = v!),
          ),
          const SizedBox(height: 12),
          TextField(controller: _subject, decoration: const InputDecoration(labelText: 'Subject')),
          const SizedBox(height: 12),
          TextField(controller: _message, maxLines: 6, decoration: const InputDecoration(labelText: 'How can we help?')),
          const SizedBox(height: 20),
          FilledButton(onPressed: _busy ? null : _send, child: const Text('Send')),
        ]),
      );
}
