import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../state/data.dart';
import '../../widgets/business_card.dart';
import '../../widgets/common.dart';

class MarketplaceScreen extends ConsumerStatefulWidget {
  const MarketplaceScreen({super.key, this.category, this.autofocus = false});
  final String? category;
  final bool autofocus;
  @override
  ConsumerState<MarketplaceScreen> createState() => _MarketplaceScreenState();
}

class _MarketplaceScreenState extends ConsumerState<MarketplaceScreen> {
  late BusinessQuery _q = BusinessQuery(category: widget.category);
  final _search = TextEditingController();
  Timer? _debounce;

  void _onSearch(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () => setState(() => _q = _q.copyWith(query: v.trim())));
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _filters() async {
    final cityCtrl = TextEditingController(text: _q.city);
    double rating = _q.minRating ?? 0;
    final result = await showModalBottomSheet<BusinessQuery>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Filters', style: Theme.of(ctx).textTheme.titleLarge),
            const SizedBox(height: 16),
            TextField(controller: cityCtrl, decoration: const InputDecoration(labelText: 'City', prefixIcon: Icon(Icons.location_city))),
            const SizedBox(height: 16),
            Text('Minimum rating: ${rating == 0 ? 'Any' : rating.toStringAsFixed(1)}'),
            Slider(value: rating, min: 0, max: 5, divisions: 10, onChanged: (v) => set(() => rating = v)),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, BusinessQuery(query: _q.query, category: _q.category, city: cityCtrl.text.trim(), minRating: rating == 0 ? null : rating)),
              child: const Text('Apply'),
            ),
          ]),
        ),
      ),
    );
    if (result != null) setState(() => _q = result);
  }

  @override
  Widget build(BuildContext context) {
    final results = ref.watch(businessesProvider(_q));
    return Scaffold(
      appBar: AppBar(
        title: const Text('Explore'),
        actions: [
          IconButton(icon: const Icon(Icons.map_outlined), tooltip: 'Map', onPressed: () => context.push('/map')),
          IconButton(icon: const Icon(Icons.tune), tooltip: 'Filters', onPressed: _filters),
        ],
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: TextField(
            controller: _search,
            autofocus: widget.autofocus,
            onChanged: _onSearch,
            textInputAction: TextInputAction.search,
            decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Search by name or service'),
          ),
        ),
        SizedBox(
          height: 44,
          child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 12), children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: ChoiceChip(label: const Text('All'), selected: _q.category == null, onSelected: (_) => setState(() => _q = _q.copyWith(clearCategory: true))),
            ),
            for (final e in categories.entries)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: ChoiceChip(label: Text(e.value), selected: _q.category == e.key, onSelected: (_) => setState(() => _q = _q.copyWith(category: e.key))),
              ),
          ]),
        ),
        Expanded(
          child: AsyncView(
            value: results,
            onRefresh: () async => ref.invalidate(businessesProvider(_q)),
            builder: (p) => p.items.isEmpty
                ? const EmptyState(icon: Icons.search_off, title: 'No businesses found', message: 'Try a different search or clear filters.')
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: p.items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) => BusinessCard(p.items[i]),
                  ),
          ),
        ),
      ]),
    );
  }
}
