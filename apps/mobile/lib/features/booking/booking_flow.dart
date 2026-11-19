import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/design_tokens.dart';
import '../../core/format.dart';
import '../../models/models.dart';
import '../../state/data.dart';
import '../../widgets/common.dart';

/// Service → staff → date/time → notes → confirm.
class BookingFlowScreen extends ConsumerStatefulWidget {
  const BookingFlowScreen({super.key, required this.businessId, this.serviceId});
  final String businessId;
  final String? serviceId;
  @override
  ConsumerState<BookingFlowScreen> createState() => _BookingFlowState();
}

class _BookingFlowState extends ConsumerState<BookingFlowScreen> {
  Service? _service;
  Staff? _staff;
  DateTime _day = DateUtils.dateOnly(DateTime.now());
  String? _time;
  final _notes = TextEditingController();
  bool _busy = false;

  /// Opening hours for a weekday from the business' `operatingHours` JSON, default 09:00–18:00.
  (int, int)? _hoursFor(Business b, DateTime day) {
    final raw = b.raw['operatingHours'];
    Map? hours;
    try {
      hours = raw is String ? jsonDecode(raw) as Map : raw as Map?;
    } catch (_) {}
    if (hours == null) return (9 * 60, 18 * 60);
    final key = DateFormat('EEEE').format(day).toLowerCase();
    final h = hours[key] ?? hours[key.substring(0, 3)];
    if (h is! Map) return (9 * 60, 18 * 60);
    if (h['closed'] == true || h['isOpen'] == false) return null;
    int parse(dynamic t, int d) {
      final m = RegExp(r'(\d{1,2}):(\d{2})').firstMatch('$t');
      return m == null ? d : int.parse(m[1]!) * 60 + int.parse(m[2]!);
    }

    return (parse(h['open'] ?? h['start'], 9 * 60), parse(h['close'] ?? h['end'], 18 * 60));
  }

  List<String> _slots(Business b) {
    final hours = _hoursFor(b, _day);
    if (hours == null) return const [];
    final dur = _service?.duration ?? 30;
    final now = DateTime.now();
    final out = <String>[];
    for (var m = hours.$1; m + dur <= hours.$2; m += 30) {
      final t = DateTime(_day.year, _day.month, _day.day, m ~/ 60, m % 60);
      if (t.isAfter(now.add(const Duration(minutes: 30)))) out.add(DateFormat('HH:mm').format(t));
    }
    return out;
  }

  String _endTime(String start, int duration) {
    final p = start.split(':').map(int.parse).toList();
    final total = p[0] * 60 + p[1] + duration;
    return '${(total ~/ 60 % 24).toString().padLeft(2, '0')}:${(total % 60).toString().padLeft(2, '0')}';
  }

  Future<void> _submit() async {
    if (_service == null || _time == null) return;
    setState(() => _busy = true);
    await guard(context, () async {
      final created = asMap(await ref.read(apiProvider).post('/bookings', {
        'businessId': widget.businessId,
        'serviceId': _service!.id,
        if (_staff != null) 'staffId': _staff!.id,
        'date': isoDate(_day),
        'startTime': _time,
        'endTime': _endTime(_time!, _service!.duration),
        if (_notes.text.trim().isNotEmpty) 'notes': _notes.text.trim(),
      }));
      ref.invalidate(bookingsProvider);
      if (mounted) context.pushReplacement('/booking/${created['id']}?pay=1');
    });
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(businessProvider(widget.businessId));
    return Scaffold(
      appBar: AppBar(title: const Text('Book appointment')),
      body: AsyncView(
        value: async,
        builder: (b) {
          final services = b.services.where((s) => s.isActive).toList();
          _service ??= services.where((s) => s.id == widget.serviceId).firstOrNull;
          final slots = _slots(b);
          return ListView(padding: const EdgeInsets.only(bottom: 120), children: [
            ListTile(leading: NetImage(b.logo, width: 44, height: 44), title: Text(b.name), subtitle: Text(b.locationLabel)),
            const SectionHeader('1. Choose a service'),
            if (services.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('This business has no bookable services yet.')),
            for (final s in services)
              RadioListTile<String>(
                value: s.id,
                groupValue: _service?.id,
                onChanged: (_) => setState(() {
                  _service = s;
                  _time = null;
                }),
                title: Text(s.name),
                subtitle: Text(duration(s.duration)),
                secondary: Text(money(s.price), style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
            if (b.staff.isNotEmpty) ...[
              const SectionHeader('2. Choose a stylist (optional)'),
              SizedBox(
                height: 48,
                child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 12), children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: ChoiceChip(label: const Text('Anyone'), selected: _staff == null, onSelected: (_) => setState(() => _staff = null)),
                  ),
                  for (final s in b.staff.where((s) => s.isActive))
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: ChoiceChip(
                        avatar: Avatar(url: s.avatar, name: s.name, size: 24),
                        label: Text(s.name),
                        selected: _staff?.id == s.id,
                        onSelected: (_) => setState(() => _staff = s),
                      ),
                    ),
                ]),
              ),
            ],
            SectionHeader('${b.staff.isNotEmpty ? 3 : 2}. Pick a date & time'),
            SizedBox(
              height: 76,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                itemCount: 21,
                itemBuilder: (_, i) {
                  final d = DateUtils.dateOnly(DateTime.now()).add(Duration(days: i));
                  final sel = DateUtils.isSameDay(d, _day);
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(StyraTokens.radiusSm),
                      onTap: () => setState(() {
                        _day = d;
                        _time = null;
                      }),
                      child: Container(
                        width: 56,
                        decoration: BoxDecoration(
                          gradient: sel ? StyraTokens.brandGradient : null,
                          border: sel ? null : Border.all(color: Theme.of(context).dividerColor),
                          borderRadius: BorderRadius.circular(StyraTokens.radiusSm),
                        ),
                        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                          Text(DateFormat('EEE').format(d), style: TextStyle(fontSize: 12, color: sel ? Colors.white : null)),
                          Text('${d.day}', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: sel ? Colors.white : null)),
                          Text(DateFormat('MMM').format(d), style: TextStyle(fontSize: 11, color: sel ? Colors.white70 : null)),
                        ]),
                      ),
                    ),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: slots.isEmpty
                  ? const Text('No available times on this day.')
                  : Wrap(spacing: 8, runSpacing: 8, children: [
                      for (final t in slots) ChoiceChip(label: Text(t), selected: _time == t, onSelected: (_) => setState(() => _time = t)),
                    ]),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(controller: _notes, maxLines: 3, maxLength: 2000, decoration: const InputDecoration(labelText: 'Notes for the provider (optional)')),
            ),
          ]);
        },
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            if (_service != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(children: [
                  Expanded(child: Text('${_service!.name}${_time != null ? ' · ${shortDate(_day)} $_time' : ''}', maxLines: 1, overflow: TextOverflow.ellipsis)),
                  Text(money(_service!.price), style: const TextStyle(fontWeight: FontWeight.w700)),
                ]),
              ),
            FilledButton(
              onPressed: _service == null || _time == null || _busy ? null : _submit,
              child: Text(_busy ? 'Booking…' : 'Confirm booking'),
            ),
          ]),
        ),
      ),
    );
  }
}
