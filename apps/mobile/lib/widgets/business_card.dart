import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/design_tokens.dart';
import '../models/models.dart';
import 'common.dart';

class BusinessCard extends StatelessWidget {
  const BusinessCard(this.b, {super.key, this.compact = false});
  final Business b;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6);
    final meta = Row(children: [
      const Icon(Icons.star, size: 14, color: Color(0xFFFBBF24)),
      const SizedBox(width: 3),
      Text(b.rating.toStringAsFixed(1), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
      Text(' (${b.reviewCount})', style: TextStyle(color: muted, fontSize: 12)),
      if (b.distanceKm != null) Text('  ·  ${b.distanceKm!.toStringAsFixed(1)} km', style: TextStyle(color: muted, fontSize: 12)),
    ]);

    final title = Row(children: [
      Flexible(child: Text(b.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15))),
      if (b.isVerified) const Padding(padding: EdgeInsets.only(left: 4), child: Icon(Icons.verified, size: 16, color: StyraTokens.secondary)),
    ]);

    if (compact) {
      return SizedBox(
        width: 220,
        child: Card(
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: () => context.push('/business/${b.id}'),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              NetImage(b.coverImage ?? b.logo, height: 110, width: 220, radius: 0),
              Padding(
                padding: const EdgeInsets.all(10),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  title,
                  const SizedBox(height: 4),
                  meta,
                  const SizedBox(height: 2),
                  Text(b.city ?? b.category, maxLines: 1, style: TextStyle(color: muted, fontSize: 12)),
                ]),
              ),
            ]),
          ),
        ),
      );
    }

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/business/${b.id}'),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(children: [
            NetImage(b.logo ?? b.coverImage, width: 76, height: 76),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                title,
                const SizedBox(height: 4),
                meta,
                const SizedBox(height: 4),
                Text(
                  [b.category.isEmpty ? null : b.category[0].toUpperCase() + b.category.substring(1), b.locationLabel.isEmpty ? null : b.locationLabel]
                      .whereType<String>()
                      .join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: muted, fontSize: 12),
                ),
              ]),
            ),
            const Icon(Icons.chevron_right),
          ]),
        ),
      ),
    );
  }
}
