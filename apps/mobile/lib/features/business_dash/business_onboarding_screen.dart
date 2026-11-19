import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../models/models.dart';
import '../../state/auth.dart';
import '../../state/data.dart';
import '../../widgets/common.dart';

/// Create a business (onboarding) or edit an existing one.
class BusinessOnboardingScreen extends ConsumerStatefulWidget {
  const BusinessOnboardingScreen({super.key, this.existing});
  final Business? existing;
  @override
  ConsumerState<BusinessOnboardingScreen> createState() => _OnboardingState();
}

class _OnboardingState extends ConsumerState<BusinessOnboardingScreen> {
  final _form = GlobalKey<FormState>();
  late final b = widget.existing;
  late final _name = TextEditingController(text: b?.name);
  late final _desc = TextEditingController(text: b?.description);
  late String _category = categories.containsKey(b?.category) ? b!.category : 'barber';
  late final _address = TextEditingController(text: b?.address);
  late final _city = TextEditingController(text: b?.city ?? 'Nairobi');
  late final _country = TextEditingController(text: asStr(b?.raw['country']) ?? 'Kenya');
  late final _phone = TextEditingController(text: b?.phone);
  late final _email = TextEditingController(text: b?.email);
  late final _website = TextEditingController(text: b?.website);
  late final _logo = TextEditingController(text: b?.logo);
  late final _cover = TextEditingController(text: b?.coverImage);
  late final _lat = TextEditingController(text: b?.lat?.toString());
  late final _lng = TextEditingController(text: b?.lng?.toString());
  bool _busy = false;

  String? _opt(TextEditingController c) => c.text.trim().isEmpty ? null : c.text.trim();

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    final body = <String, dynamic>{
      'name': _name.text.trim(),
      'description': _opt(_desc),
      'category': _category,
      'address': _address.text.trim(),
      'city': _city.text.trim(),
      'country': _opt(_country),
      'phone': _opt(_phone),
      'email': _opt(_email),
      'website': _opt(_website),
      'logo': _opt(_logo),
      'coverImage': _opt(_cover),
      'latitude': double.tryParse(_lat.text.trim()),
      'longitude': double.tryParse(_lng.text.trim()),
    }..removeWhere((_, v) => v == null);

    final ok = await guard(context, () async {
      final api = ref.read(apiProvider);
      if (b == null) {
        await api.post('/businesses', body);
        await ref.read(authProvider.notifier).reloadUser(); // role becomes BUSINESS_OWNER
      } else {
        await api.patch('/businesses/${b!.id}', body);
      }
      ref.invalidate(profileProvider);
    }, success: b == null ? 'Business submitted for review' : 'Business updated');
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) {
      if (b == null) {
        context.go('/');
      } else {
        Navigator.of(context).pop();
      }
    }
  }

  Widget _field(TextEditingController c, String label, {String? Function(String?)? validator, TextInputType? type, int lines = 1}) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TextFormField(controller: c, keyboardType: type, maxLines: lines, validator: validator, decoration: InputDecoration(labelText: label)),
      );

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(b == null ? 'List your business' : 'Edit business')),
        body: Form(
          key: _form,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            if (b == null) const Padding(padding: EdgeInsets.only(bottom: 16), child: Text('Tell customers about your business. Our team reviews new listings before they go live.')),
            _field(_name, 'Business name', validator: (v) => (v ?? '').trim().length < 2 ? 'Required' : null),
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: DropdownButtonFormField<String>(
                value: _category,
                decoration: const InputDecoration(labelText: 'Category'),
                items: [for (final e in categories.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
                onChanged: (v) => setState(() => _category = v!),
              ),
            ),
            _field(_desc, 'Description', lines: 3),
            _field(_address, 'Street address', validator: (v) => (v ?? '').trim().length < 5 ? 'At least 5 characters' : null),
            Row(children: [
              Expanded(child: _field(_city, 'City', validator: (v) => (v ?? '').trim().length < 2 ? 'Required' : null)),
              const SizedBox(width: 8),
              Expanded(child: _field(_country, 'Country')),
            ]),
            _field(_phone, 'Phone', type: TextInputType.phone,
                validator: (v) => (v ?? '').isEmpty || RegExp(r'^\+?[1-9]\d{1,14}$').hasMatch(v!.trim()) ? null : 'e.g. +254712345678'),
            _field(_email, 'Business email', type: TextInputType.emailAddress),
            _field(_website, 'Website (https://…)', type: TextInputType.url),
            _field(_logo, 'Logo image URL', type: TextInputType.url),
            _field(_cover, 'Cover image URL', type: TextInputType.url),
            Row(children: [
              Expanded(child: _field(_lat, 'Latitude', type: const TextInputType.numberWithOptions(decimal: true, signed: true))),
              const SizedBox(width: 8),
              Expanded(child: _field(_lng, 'Longitude', type: const TextInputType.numberWithOptions(decimal: true, signed: true))),
            ]),
            const SizedBox(height: 8),
            FilledButton(onPressed: _busy ? null : _save, child: Text(b == null ? 'Submit for review' : 'Save changes')),
          ]),
        ),
      );
}
