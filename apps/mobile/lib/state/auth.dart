import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_client.dart';
import '../models/models.dart';

enum AuthStatus { unknown, signedOut, signedIn }

class AuthState {
  const AuthState(this.status, [this.user]);
  final AuthStatus status;
  final AppUser? user;
}

class AuthController extends StateNotifier<AuthState> {
  AuthController(this._api) : super(const AuthState(AuthStatus.unknown)) {
    _api.onUnauthorized = () {
      if (state.status == AuthStatus.signedIn) state = const AuthState(AuthStatus.signedOut);
    };
    restore();
  }

  final ApiClient _api;

  /// Listenable for go_router refreshes.
  final refresh = ValueNotifier<int>(0);

  @override
  set state(AuthState value) {
    super.state = value;
    refresh.value++;
  }

  Future<void> restore() async {
    if (!await _api.hasSessionCookie()) {
      state = const AuthState(AuthStatus.signedOut);
      return;
    }
    try {
      final me = await _api.get('/auth/me');
      state = AuthState(AuthStatus.signedIn, AppUser(_unwrapUser(me)));
    } catch (_) {
      state = const AuthState(AuthStatus.signedOut);
    }
  }

  Json _unwrapUser(dynamic d) {
    final m = asMap(d);
    return m['user'] is Map ? asMap(m['user']) : m;
  }

  Future<void> login(String email, String password) async {
    final d = await _api.post('/auth/login', {'email': email.trim(), 'password': password});
    state = AuthState(AuthStatus.signedIn, AppUser(_unwrapUser(d)));
  }

  /// Returns the server message (registration usually requires email verification).
  Future<void> register({required String name, required String email, required String password, String? phone, String role = 'CUSTOMER'}) async {
    final d = await _api.post('/auth/register', {
      'name': name.trim(),
      'email': email.trim(),
      'password': password,
      if (phone != null && phone.isNotEmpty) 'phone': phone.trim(),
      'role': role,
    });
    final u = _unwrapUser(d);
    if (u['id'] != null && await _api.hasSessionCookie()) {
      state = AuthState(AuthStatus.signedIn, AppUser(u));
    } else {
      await login(email, password);
    }
  }

  Future<void> reloadUser() async {
    final me = await _api.get('/auth/me');
    state = AuthState(AuthStatus.signedIn, AppUser(_unwrapUser(me)));
  }

  Future<void> logout({bool allDevices = false}) async {
    try {
      await _api.post(allDevices ? '/auth/logout-all' : '/auth/logout');
    } catch (_) {}
    await _api.clearSession();
    state = const AuthState(AuthStatus.signedOut);
  }
}

final authProvider = StateNotifierProvider<AuthController, AuthState>((ref) => AuthController(ref.watch(apiProvider)));
final currentUserProvider = Provider<AppUser?>((ref) => ref.watch(authProvider).user);
