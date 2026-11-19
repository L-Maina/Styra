import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';

import '../../core/design_tokens.dart';
import '../../models/models.dart';
import '../../state/data.dart';
import '../../widgets/business_card.dart';

const _mapQuery = BusinessQuery(limit: 100);

/// OpenStreetMap view of businesses (no API key needed).
class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({super.key});
  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends ConsumerState<MapScreen> {
  Business? _selected;

  @override
  Widget build(BuildContext context) {
    final res = ref.watch(businessesProvider(_mapQuery));
    final pins = res.valueOrNull?.items.where((b) => b.lat != null && b.lng != null).toList() ?? const <Business>[];
    final center = pins.isNotEmpty ? LatLng(pins.first.lat!, pins.first.lng!) : const LatLng(-1.2864, 36.8172); // Nairobi

    return Scaffold(
      appBar: AppBar(title: const Text('Nearby')),
      body: Stack(children: [
        FlutterMap(
          options: MapOptions(initialCenter: center, initialZoom: 12, onTap: (_, __) => setState(() => _selected = null)),
          children: [
            TileLayer(urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', userAgentPackageName: 'com.styra.mobile'),
            MarkerLayer(markers: [
              for (final b in pins)
                Marker(
                  point: LatLng(b.lat!, b.lng!),
                  width: 40,
                  height: 40,
                  child: GestureDetector(
                    onTap: () => setState(() => _selected = b),
                    child: Icon(Icons.location_on, size: 40, color: _selected?.id == b.id ? StyraTokens.secondary : StyraTokens.primary),
                  ),
                ),
            ]),
            const RichAttributionWidget(attributions: [TextSourceAttribution('OpenStreetMap contributors')]),
          ],
        ),
        if (res.isLoading) const LinearProgressIndicator(),
        if (_selected != null) Positioned(left: 16, right: 16, bottom: 24, child: BusinessCard(_selected!)),
        if (!res.isLoading && pins.isEmpty)
          const Positioned(
            left: 16,
            right: 16,
            top: 16,
            child: Card(child: Padding(padding: EdgeInsets.all(12), child: Text('No businesses with a map location yet.'))),
          ),
      ]),
    );
  }
}
