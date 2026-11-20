import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/design_tokens.dart';
import '../../core/format.dart';
import '../../models/models.dart';
import '../../state/auth.dart';
import '../../state/data.dart';
import '../../widgets/common.dart';

class BusinessProfileScreen extends ConsumerWidget {
  const BusinessProfileScreen({super.key, required this.id});
  final String id;

  Future<void> _message(BuildContext context, WidgetRef ref, Business b) async {
    await guard(context, () async {
      final c = asMap(await ref.read(apiProvider).post('/conversations', {'otherUserId': b.ownerId, 'businessId': b.id}));
      if (context.mounted) context.push('/chat/${c['id']}', extra: {'id': b.ownerId, 'name': b.name, 'avatar': b.logo});
    });
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(businessProvider(id));
    final me = ref.watch(currentUserProvider);
    return Scaffold(
      body: AsyncView(
        value: async,
        onRefresh: () async => ref.invalidate(businessProvider(id)),
        builder: (b) {
          final muted = Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6);
          final services = b.services.where((s) => s.isActive).toList();
          return CustomScrollView(slivers: [
            SliverAppBar(
              pinned: true,
              expandedHeight: 220,
              flexibleSpace: FlexibleSpaceBar(
                title: Text(b.name, style: const TextStyle(fontSize: 16, shadows: [Shadow(blurRadius: 8)])),
                background: NetImage(b.coverImage ?? b.logo, radius: 0, icon: Icons.storefront),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    RatingStars(b.rating, size: 18),
                    const SizedBox(width: 6),
                    Text('${b.rating.toStringAsFixed(1)} · ${b.reviewCount} reviews', style: TextStyle(color: muted)),
                    const Spacer(),
                    if (b.isVerified) const Chip(avatar: Icon(Icons.verified, size: 16, color: StyraTokens.secondary), label: Text('Verified')),
                  ]),
                  if (b.locationLabel.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Row(children: [Icon(Icons.place_outlined, size: 18, color: muted), const SizedBox(width: 4), Expanded(child: Text(b.locationLabel))]),
                  ],
                  if ((b.description ?? '').isNotEmpty) ...[const SizedBox(height: 12), Text(b.description!)],
                  const SizedBox(height: 16),
                  Row(children: [
                    if (me?.id != b.ownerId)
                      Expanded(child: OutlinedButton.icon(onPressed: () => _message(context, ref, b), icon: const Icon(Icons.chat_bubble_outline), label: const Text('Message'))),
                    if (b.phone != null) ...[
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => launchUrl(Uri(scheme: 'tel', path: b.phone)),
                          icon: const Icon(Icons.call_outlined),
                          label: const Text('Call'),
                        ),
                      ),
                    ],
                    if (b.lat != null && b.lng != null) ...[
                      const SizedBox(width: 8),
                      IconButton.outlined(
                        onPressed: () => launchUrl(Uri.parse('https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}'), mode: LaunchMode.externalApplication),
                        icon: const Icon(Icons.directions_outlined),
                      ),
                    ],
                  ]),
                ]),
              ),
            ),
            const SliverToBoxAdapter(child: SectionHeader('Services')),
            if (services.isEmpty)
              const SliverToBoxAdapter(child: Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: Text('No services listed yet.')))
            else
              SliverList.separated(
                itemCount: services.length,
                separatorBuilder: (_, __) => const Divider(height: 1, indent: 16, endIndent: 16),
                itemBuilder: (_, i) {
                  final s = services[i];
                  return ListTile(
                    title: Text(s.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text([duration(s.duration), if ((s.description ?? '').isNotEmpty) s.description!].join(' · '), maxLines: 2, overflow: TextOverflow.ellipsis),
                    trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Text(money(s.price), style: const TextStyle(fontWeight: FontWeight.w700)),
                      const Text('Book', style: TextStyle(color: StyraTokens.primary, fontSize: 12)),
                    ]),
                    onTap: () => context.push('/book/${b.id}?service=${s.id}'),
                  );
                },
              ),
            if (b.staff.isNotEmpty) ...[
              const SliverToBoxAdapter(child: SectionHeader('Team')),
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 96,
                  child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 12), children: [
                    for (final s in b.staff.where((s) => s.isActive))
                      SizedBox(
                        width: 80,
                        child: Column(children: [
                          Avatar(url: s.avatar, name: s.name, size: 52),
                          const SizedBox(height: 6),
                          Text(s.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12)),
                          Text(s.role ?? '', maxLines: 1, style: TextStyle(fontSize: 11, color: muted)),
                        ]),
                      ),
                  ]),
                ),
              ),
            ],
            if (b.portfolio.isNotEmpty) ...[
              const SliverToBoxAdapter(child: SectionHeader('Portfolio')),
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverGrid.count(
                  crossAxisCount: 3,
                  mainAxisSpacing: 6,
                  crossAxisSpacing: 6,
                  children: [for (final p in b.portfolio) NetImage(p)],
                ),
              ),
            ],
            SliverToBoxAdapter(child: SectionHeader('Reviews (${b.reviews.length})')),
            if (b.reviews.isEmpty)
              const SliverToBoxAdapter(child: Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: Text('No reviews yet.')))
            else
              SliverList.builder(
                itemCount: b.reviews.length,
                itemBuilder: (_, i) {
                  final r = b.reviews[i];
                  return ListTile(
                    leading: Avatar(url: r.authorAvatar, name: r.author),
                    title: Row(children: [Expanded(child: Text(r.author)), RatingStars(r.rating.toDouble())]),
                    subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      if ((r.comment ?? '').isNotEmpty) Text(r.comment!),
                      Text(shortDate(r.createdAt), style: TextStyle(fontSize: 11, color: muted)),
                    ]),
                  );
                },
              ),
            const SliverToBoxAdapter(child: SizedBox(height: 100)),
          ]);
        },
      ),
      bottomNavigationBar: async.hasValue && me?.id != async.value!.ownerId
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                child: FilledButton(onPressed: () => context.push('/book/$id'), child: const Text('Book an appointment')),
              ),
            )
          : null,
    );
  }
}
