import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'features/auth/auth_screens.dart';
import 'features/booking/booking_flow.dart';
import 'features/booking/booking_detail_screen.dart';
import 'features/business/business_profile_screen.dart';
import 'features/business_dash/business_onboarding_screen.dart';
import 'features/chat/chat_screens.dart';
import 'features/claims/claims_screens.dart';
import 'features/disputes/disputes_screen.dart';
import 'features/map/map_screen.dart';
import 'features/notifications/notifications_screen.dart';
import 'features/profile/profile_screens.dart';
import 'features/shell/home_shell.dart';
import 'features/wallet/wallet_screens.dart';
import 'state/auth.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.read(authProvider.notifier);
  const public = {'/login', '/register', '/forgot'};

  return GoRouter(
    initialLocation: '/',
    refreshListenable: auth.refresh,
    redirect: (context, state) {
      final s = ref.read(authProvider).status;
      final loc = state.matchedLocation;
      if (s == AuthStatus.unknown) return loc == '/splash' ? null : '/splash';
      final signedIn = s == AuthStatus.signedIn;
      if (!signedIn && !public.contains(loc)) return '/login';
      if (signedIn && (public.contains(loc) || loc == '/splash')) return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
      GoRoute(path: '/forgot', builder: (_, __) => const ForgotPasswordScreen()),
      GoRoute(path: '/', builder: (_, __) => const HomeShell()),
      GoRoute(path: '/map', builder: (_, __) => const MapScreen()),
      GoRoute(path: '/business/:id', builder: (_, s) => BusinessProfileScreen(id: s.pathParameters['id']!)),
      GoRoute(
        path: '/book/:businessId',
        builder: (_, s) => BookingFlowScreen(businessId: s.pathParameters['businessId']!, serviceId: s.uri.queryParameters['service']),
      ),
      GoRoute(path: '/booking/:id', builder: (_, s) => BookingDetailScreen(id: s.pathParameters['id']!)),
      GoRoute(
        path: '/chat/:id',
        builder: (_, s) => ChatScreen(conversationId: s.pathParameters['id']!, other: s.extra is Map ? Map<String, dynamic>.from(s.extra as Map) : const {}),
      ),
      GoRoute(path: '/notifications', builder: (_, __) => const NotificationsScreen()),
      GoRoute(path: '/notifications/preferences', builder: (_, __) => const NotificationPreferencesScreen()),
      GoRoute(path: '/wallet', builder: (_, __) => const WalletScreen()),
      GoRoute(path: '/transactions', builder: (_, __) => const TransactionsScreen()),
      GoRoute(path: '/disputes', builder: (_, __) => const DisputesScreen()),
      GoRoute(path: '/claims', builder: (_, __) => const ClaimsScreen()),
      GoRoute(path: '/claims/new', builder: (_, s) => NewClaimScreen(bookingId: s.uri.queryParameters['booking'])),
      GoRoute(path: '/protection', builder: (_, __) => const ProtectionPlanScreen()),
      GoRoute(path: '/profile/edit', builder: (_, __) => const EditProfileScreen()),
      GoRoute(path: '/support', builder: (_, __) => const SupportScreen()),
      GoRoute(path: '/onboarding/business', builder: (_, __) => const BusinessOnboardingScreen()),
    ],
    errorBuilder: (_, s) => Scaffold(appBar: AppBar(), body: Center(child: Text('Page not found: ${s.uri}'))),
  );
});

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
        body: Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Image.asset('assets/branding/logo-icon.png', width: 72, height: 72),
            const SizedBox(height: 24),
            const CircularProgressIndicator(),
          ]),
        ),
      );
}
