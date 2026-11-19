import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/design_tokens.dart';
import '../../core/format.dart';
import '../../models/models.dart';
import '../../state/auth.dart';
import '../../state/data.dart';
import '../../widgets/business_card.dart';
import '../../widgets/common.dart';
import '../auth/auth_screens.dart';
import '../marketplace/marketplace_screen.dart';
import '../notifications/notifications_screen.dart';

const _featured = BusinessQuery(limit: 10, minRating: 0);

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final featured = ref.watch(businessesProvider(_featured));
    final upcoming = ref.watch(bookingsProvider(null));

    return Scaffold(
      appBar: AppBar(
        title: Image.asset('assets/branding/logo-full.png', height: 28),
        actions: const [NotificationBell()],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(businessesProvider(_featured));
          ref.invalidate(bookingsProvider(null));
        },
        child: ListView(children: [
          const VerifyEmailBanner(),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Text('Hi ${user?.name.split(' ').first ?? 'there'} 👋', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
          ),
          const Padding(padding: EdgeInsets.fromLTRB(16, 4, 16, 12), child: Text('Find and book trusted groomers near you')),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: TextField(
              readOnly: true,
              onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const MarketplaceScreen(autofocus: true))),
              decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Search barbers, salons, spas…'),
            ),
          ),
          const SectionHeader('Categories'),
          SizedBox(
            height: 92,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              children: [
                for (final e in categories.entries)
                  _CategoryTile(
                    label: e.value,
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => MarketplaceScreen(category: e.key))),
                  ),
              ],
            ),
          ),
          upcoming.maybeWhen(
            data: (p) {
              final next = p.items.where((b) => isStatus(b.status, const ['CONFIRMED', 'PENDING'])).where((b) => b.when == null || b.when!.isAfter(DateTime.now().subtract(const Duration(hours: 2)))).toList();
              if (next.isEmpty) return const SizedBox.shrink();
              final b = next.first;
              return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const SectionHeader('Your next appointment'),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Container(
                    decoration: BoxDecoration(gradient: StyraTokens.brandGradient, borderRadius: BorderRadius.circular(StyraTokens.radius)),
                    child: ListTile(
                      textColor: Colors.white,
                      iconColor: Colors.white,
                      leading: const Icon(Icons.event_available),
                      title: Text('${b.serviceName} · ${b.businessName}', style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text('${shortDate(b.when)} at ${b.time}'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push('/booking/${b.id}'),
                    ),
                  ),
                ),
              ]);
            },
            orElse: () => const SizedBox.shrink(),
          ),
          SectionHeader('Featured', action: 'Map view', onAction: () => context.push('/map')),
          SizedBox(
            height: 210,
            child: featured.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text(e.toString())),
              data: (p) => p.items.isEmpty
                  ? const Center(child: Text('No businesses yet'))
                  : ListView.separated(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: p.items.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 12),
                      itemBuilder: (_, i) => BusinessCard(p.items[i], compact: true),
                    ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Card(
              child: ListTile(
                leading: const Icon(Icons.storefront_outlined, color: StyraTokens.primary),
                title: const Text('Own a grooming business?'),
                subtitle: const Text('List it on Styra and get booked.'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.push('/onboarding/business'),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

class _CategoryTile extends StatelessWidget {
  const _CategoryTile({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  static const _icons = {
    'Barber': Icons.content_cut,
    'Salon': Icons.face_retouching_natural,
    'Spa': Icons.spa_outlined,
    'Nails': Icons.back_hand_outlined,
    'Makeup': Icons.brush_outlined,
    'Braids': Icons.waves,
    'Massage': Icons.self_improvement,
    'Skincare': Icons.water_drop_outlined,
  };

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(StyraTokens.radius),
        child: SizedBox(
          width: 78,
          child: Column(children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(color: StyraTokens.primary.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(StyraTokens.radius)),
              child: Icon(_icons[label] ?? Icons.category_outlined, color: StyraTokens.primary),
            ),
            const SizedBox(height: 6),
            Text(label, style: const TextStyle(fontSize: 12)),
          ]),
        ),
      );
}
