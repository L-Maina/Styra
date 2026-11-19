import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../state/auth.dart';
import '../../widgets/common.dart';

class _AuthScaffold extends StatelessWidget {
  const _AuthScaffold({required this.title, required this.subtitle, required this.children});
  final String title, subtitle;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(),
        body: SafeArea(
          child: ListView(padding: const EdgeInsets.fromLTRB(24, 0, 24, 24), children: [
            Center(child: Image.asset('assets/branding/logo-icon.png', height: 56)),
            const SizedBox(height: 20),
            Text(title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text(subtitle, textAlign: TextAlign.center, style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6))),
            const SizedBox(height: 28),
            ...children,
          ]),
        ),
      );
}

String? _validEmail(String? v) => v != null && RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v.trim()) ? null : 'Enter a valid email';

String? _validPassword(String? v) {
  if (v == null || v.length < 8) return 'At least 8 characters';
  if (!RegExp('[A-Z]').hasMatch(v)) return 'Add an uppercase letter';
  if (!RegExp('[a-z]').hasMatch(v)) return 'Add a lowercase letter';
  if (!RegExp('[0-9]').hasMatch(v)) return 'Add a number';
  return null;
}

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _pw = TextEditingController();
  bool _busy = false, _obscure = true;

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    await guard(context, () => ref.read(authProvider.notifier).login(_email.text, _pw.text));
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) => _AuthScaffold(
        title: 'Welcome back',
        subtitle: 'Sign in to book your next appointment',
        children: [
          Form(
            key: _form,
            child: Column(children: [
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.mail_outline)),
                validator: _validEmail,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _pw,
                obscureText: _obscure,
                autofillHints: const [AutofillHints.password],
                decoration: InputDecoration(
                  labelText: 'Password',
                  prefixIcon: const Icon(Icons.lock_outline),
                  suffixIcon: IconButton(icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility), onPressed: () => setState(() => _obscure = !_obscure)),
                ),
                validator: (v) => (v ?? '').isEmpty ? 'Enter your password' : null,
                onFieldSubmitted: (_) => _submit(),
              ),
            ]),
          ),
          Align(alignment: Alignment.centerRight, child: TextButton(onPressed: () => context.push('/forgot'), child: const Text('Forgot password?'))),
          const SizedBox(height: 8),
          FilledButton(onPressed: _busy ? null : _submit, child: _busy ? const _Spinner() : const Text('Sign in')),
          const SizedBox(height: 16),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Text('New to Styra?'),
            TextButton(onPressed: () => context.go('/register'), child: const Text('Create account')),
          ]),
        ],
      );
}

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});
  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _pw = TextEditingController();
  bool _busy = false, _provider = false;

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    final ok = await guard(context, () => ref.read(authProvider.notifier).register(
          name: _name.text,
          email: _email.text,
          password: _pw.text,
          phone: _phone.text,
        ));
    if (ok && mounted) {
      showOk(context, 'Account created. Check your email to verify your address.');
      // Providers continue to business onboarding after sign-up.
      if (_provider) context.push('/onboarding/business');
    }
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) => _AuthScaffold(
        title: 'Create your account',
        subtitle: 'Book groomers near you, or list your business',
        children: [
          SegmentedButton<bool>(
            segments: const [
              ButtonSegment(value: false, label: Text('I\'m a customer'), icon: Icon(Icons.person_outline)),
              ButtonSegment(value: true, label: Text('I\'m a provider'), icon: Icon(Icons.storefront_outlined)),
            ],
            selected: {_provider},
            onSelectionChanged: (s) => setState(() => _provider = s.first),
          ),
          const SizedBox(height: 16),
          Form(
            key: _form,
            child: Column(children: [
              TextFormField(
                controller: _name,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(labelText: 'Full name', prefixIcon: Icon(Icons.badge_outlined)),
                validator: (v) => (v ?? '').trim().length < 2 ? 'Enter your name' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.mail_outline)),
                validator: _validEmail,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Phone (optional)', hintText: '+254712345678', prefixIcon: Icon(Icons.phone_outlined)),
                validator: (v) => (v ?? '').isEmpty || RegExp(r'^\+?[1-9]\d{1,14}$').hasMatch(v!.trim()) ? null : 'Use international format, e.g. +254…',
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _pw,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Password', prefixIcon: Icon(Icons.lock_outline)),
                validator: _validPassword,
              ),
            ]),
          ),
          const SizedBox(height: 20),
          FilledButton(onPressed: _busy ? null : _submit, child: _busy ? const _Spinner() : const Text('Create account')),
          const SizedBox(height: 12),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Text('Already have an account?'),
            TextButton(onPressed: () => context.go('/login'), child: const Text('Sign in')),
          ]),
        ],
      );
}

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});
  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotState();
}

class _ForgotState extends ConsumerState<ForgotPasswordScreen> {
  final _email = TextEditingController();
  final _token = TextEditingController();
  final _pw = TextEditingController();
  bool _sent = false, _busy = false;

  Future<void> _run(Future<void> Function() f) async {
    setState(() => _busy = true);
    await guard(context, f);
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final api = ref.read(apiProvider);
    return _AuthScaffold(
      title: _sent ? 'Set a new password' : 'Reset password',
      subtitle: _sent ? 'Enter the code from the email we sent you' : 'We\'ll email you a reset link and code',
      children: _sent
          ? [
              TextField(controller: _token, decoration: const InputDecoration(labelText: 'Reset code / token')),
              const SizedBox(height: 12),
              TextField(controller: _pw, obscureText: true, decoration: const InputDecoration(labelText: 'New password')),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _busy
                    ? null
                    : () {
                        final err = _validPassword(_pw.text);
                        if (err != null) return showError(context, err);
                        _run(() async {
                          await api.post('/auth/reset-password', {'token': _token.text.trim(), 'password': _pw.text});
                          if (mounted) {
                            showOk(context, 'Password updated. Please sign in.');
                            context.go('/login');
                          }
                        });
                      },
                child: const Text('Update password'),
              ),
            ]
          : [
              TextField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email')),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _busy
                    ? null
                    : () {
                        if (_validEmail(_email.text) != null) return showError(context, 'Enter a valid email');
                        _run(() async {
                          await api.post('/auth/forgot-password', {'email': _email.text.trim()});
                          setState(() => _sent = true);
                        });
                      },
                child: const Text('Send reset email'),
              ),
            ],
    );
  }
}

/// Banner prompting unverified users to verify their email (required for payments).
class VerifyEmailBanner extends ConsumerWidget {
  const VerifyEmailBanner({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final u = ref.watch(currentUserProvider);
    if (u == null || u.isVerified) return const SizedBox.shrink();
    return Card(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: ListTile(
        leading: const Icon(Icons.mark_email_unread_outlined),
        title: const Text('Verify your email'),
        subtitle: const Text('Required before you can pay for bookings.'),
        trailing: TextButton(
          onPressed: () => guard(context, () => ref.read(apiProvider).post('/auth/resend-verification', {'email': u.email}), success: 'Verification email sent'),
          child: const Text('Resend'),
        ),
      ),
    );
  }
}

class _Spinner extends StatelessWidget {
  const _Spinner();
  @override
  Widget build(BuildContext context) => const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white));
}
