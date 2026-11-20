import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_client.dart';
import '../core/design_tokens.dart';
import '../models/models.dart';

/// Shows a snackbar with the error message.
void showError(BuildContext context, Object e) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: StyraTokens.destructive));
}

void showOk(BuildContext context, String msg) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
}

/// Runs [action], shows errors, returns true on success.
Future<bool> guard(BuildContext context, Future<void> Function() action, {String? success}) async {
  try {
    await action();
    if (success != null && context.mounted) showOk(context, success);
    return true;
  } catch (e) {
    if (context.mounted) showError(context, e);
    return false;
  }
}

/// Renders an [AsyncValue] with loading / error (retry) / data states, plus pull-to-refresh.
class AsyncView<T> extends StatelessWidget {
  const AsyncView({super.key, required this.value, required this.builder, this.onRefresh});
  final AsyncValue<T> value;
  final Widget Function(T data) builder;
  final Future<void> Function()? onRefresh;

  @override
  Widget build(BuildContext context) {
    return value.when(
      skipLoadingOnRefresh: true,
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => EmptyState(
        icon: e is ApiException && e.isUnauthorized ? Icons.lock_outline : Icons.cloud_off_outlined,
        title: 'Couldn\'t load',
        message: e.toString(),
        action: onRefresh == null ? null : FilledButton(onPressed: onRefresh, child: const Text('Try again')),
      ),
      data: (d) => onRefresh == null ? builder(d) : RefreshIndicator(onRefresh: onRefresh!, child: builder(d)),
    );
  }
}

/// Mirrors the web's GlassEmptyState.
class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, this.message, this.action});
  final IconData icon;
  final String title;
  final String? message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6);
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(32),
      children: [
        const SizedBox(height: 48),
        Center(
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(shape: BoxShape.circle, color: StyraTokens.primary.withValues(alpha: 0.12)),
            child: Icon(icon, size: 36, color: StyraTokens.primary),
          ),
        ),
        const SizedBox(height: 16),
        Text(title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
        if (message != null) ...[
          const SizedBox(height: 8),
          Text(message!, textAlign: TextAlign.center, style: TextStyle(color: muted)),
        ],
        if (action != null) ...[const SizedBox(height: 20), Center(child: SizedBox(width: 200, child: action))],
      ],
    );
  }
}

class NetImage extends StatelessWidget {
  const NetImage(this.url, {super.key, this.width, this.height, this.radius = StyraTokens.radiusSm, this.icon = Icons.content_cut});
  final String? url;
  final double? width, height, radius;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final placeholder = Container(
      width: width,
      height: height,
      decoration: const BoxDecoration(gradient: StyraTokens.brandGradient),
      child: Icon(icon, color: Colors.white70),
    );
    final u = url;
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius ?? 0),
      child: u == null || u.isEmpty || !u.startsWith('http')
          ? placeholder
          : CachedNetworkImage(imageUrl: u, width: width, height: height, fit: BoxFit.cover, errorWidget: (_, __, ___) => placeholder),
    );
  }
}

class Avatar extends StatelessWidget {
  const Avatar({super.key, this.url, required this.name, this.size = 40});
  final String? url;
  final String name;
  final double size;
  @override
  Widget build(BuildContext context) {
    final initials = name.trim().isEmpty ? '?' : name.trim().split(RegExp(r'\s+')).take(2).map((w) => w[0].toUpperCase()).join();
    return CircleAvatar(
      radius: size / 2,
      backgroundColor: StyraTokens.primary.withValues(alpha: 0.2),
      backgroundImage: url != null && url!.startsWith('http') ? CachedNetworkImageProvider(url!) : null,
      child: url != null && url!.startsWith('http') ? null : Text(initials, style: TextStyle(fontSize: size * 0.36, fontWeight: FontWeight.w600)),
    );
  }
}

class StatusChip extends StatelessWidget {
  const StatusChip(this.status, {super.key});
  final String status;

  static Color colorFor(String s) {
    switch (normalizeStatus(s)) {
      case 'PENDING':
      case 'DISPUTED':
        return StyraTokens.warning;
      case 'COMPLETED':
      case 'IN_PROGRESS':
        return StyraTokens.secondary;
      case 'NO_SHOW':
        return StyraTokens.destructive;
    }
    switch (s.toLowerCase()) {
      case 'confirmed':
      case 'completed':
      case 'approved':
      case 'released':
      case 'paid':
      case 'resolved':
      case 'verified':
        return StyraTokens.success;
      case 'cancelled':
      case 'failed':
      case 'rejected':
      case 'refunded':
      case 'banned':
        return StyraTokens.destructive;
      case 'disputed':
      case 'open':
      case 'under_review':
      case 'processing':
      case 'in_progress':
        return StyraTokens.warning;
      default:
        return StyraTokens.secondary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = colorFor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: c.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(999)),
      child: Text((bookingStatusLabels[normalizeStatus(status)] ?? status.replaceAll('_', ' ')).toUpperCase(), style: TextStyle(color: c, fontSize: 11, fontWeight: FontWeight.w700)),
    );
  }
}

class RatingStars extends StatelessWidget {
  const RatingStars(this.rating, {super.key, this.size = 14});
  final double rating;
  final double size;
  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(5, (i) {
          final icon = rating >= i + 1 ? Icons.star : (rating > i ? Icons.star_half : Icons.star_border);
          return Icon(icon, size: size, color: const Color(0xFFFBBF24));
        }),
      );
}

class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.action, this.onAction});
  final String title;
  final String? action;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 20, 8, 8),
        child: Row(children: [
          Expanded(child: Text(title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 18, fontWeight: FontWeight.w600))),
          if (action != null) TextButton(onPressed: onAction, child: Text(action!)),
        ]),
      );
}

class StatTile extends StatelessWidget {
  const StatTile({super.key, required this.label, required this.value, required this.icon, this.color = StyraTokens.primary});
  final String label, value;
  final IconData icon;
  final Color color;
  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 10),
            Text(value, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis),
            Text(label, style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6), fontSize: 12)),
          ]),
        ),
      );
}

class StatGrid extends StatelessWidget {
  const StatGrid(this.tiles, {super.key});
  final List<StatTile> tiles;
  @override
  Widget build(BuildContext context) => GridView.count(
        crossAxisCount: 2,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        childAspectRatio: 1.55,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        children: tiles,
      );
}

/// Asks for text input in a dialog. Returns null if cancelled.
Future<String?> promptText(BuildContext context, {required String title, String? hint, String confirm = 'Submit', int minLength = 0, int? maxLength, int maxLines = 4}) {
  final ctrl = TextEditingController();
  return showDialog<String>(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, set) => AlertDialog(
        title: Text(title),
        content: TextField(controller: ctrl, maxLines: maxLines, maxLength: maxLength, decoration: InputDecoration(hintText: hint), onChanged: (_) => set(() {})),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(
            onPressed: ctrl.text.trim().length < minLength ? null : () => Navigator.pop(ctx, ctrl.text.trim()),
            child: Text(confirm),
          ),
        ],
      ),
    ),
  );
}

Future<bool> confirm(BuildContext context, String title, {String? message, String ok = 'Confirm', bool destructive = false}) async {
  final r = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: message == null ? null : Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
        TextButton(
          onPressed: () => Navigator.pop(ctx, true),
          child: Text(ok, style: destructive ? const TextStyle(color: StyraTokens.destructive) : null),
        ),
      ],
    ),
  );
  return r ?? false;
}

/// Convenience: a FutureProvider.autoDispose.family wrapper type.
typedef Loader<T> = AutoDisposeFutureProvider<T>;
