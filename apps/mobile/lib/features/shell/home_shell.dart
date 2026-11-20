import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/models.dart';
import '../../state/auth.dart';
import '../admin/admin_dashboard.dart';
import '../bookings/my_bookings_screen.dart';
import '../business_dash/business_dashboard.dart';
import '../chat/chat_screens.dart';
import '../home/home_screen.dart';
import '../marketplace/marketplace_screen.dart';
import '../profile/profile_screens.dart';

class _Tab {
  const _Tab(this.label, this.icon, this.activeIcon, this.page);
  final String label;
  final IconData icon, activeIcon;
  final Widget page;
}

/// Bottom-nav shell. Tabs depend on the signed-in user's role.
class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key});
  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> {
  int _index = 0;

  List<_Tab> _tabs(UserRole role) {
    const explore = _Tab('Explore', Icons.search_outlined, Icons.search, MarketplaceScreen());
    const messages = _Tab('Messages', Icons.chat_bubble_outline, Icons.chat_bubble, ConversationsScreen());
    const profile = _Tab('Profile', Icons.person_outline, Icons.person, ProfileScreen());
    switch (role) {
      case UserRole.admin:
        return const [
          _Tab('Admin', Icons.shield_outlined, Icons.shield, AdminDashboard()),
          explore,
          messages,
          profile,
        ];
      case UserRole.businessOwner:
        return const [
          _Tab('Dashboard', Icons.storefront_outlined, Icons.storefront, BusinessDashboard()),
          _Tab('Bookings', Icons.calendar_today_outlined, Icons.calendar_today, MyBookingsScreen(asProvider: true)),
          messages,
          profile,
        ];
      case UserRole.customer:
        return const [
          _Tab('Home', Icons.home_outlined, Icons.home, HomeScreen()),
          explore,
          _Tab('Bookings', Icons.calendar_today_outlined, Icons.calendar_today, MyBookingsScreen()),
          messages,
          profile,
        ];
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = ref.watch(currentUserProvider)?.role ?? UserRole.customer;
    final tabs = _tabs(role);
    if (_index >= tabs.length) _index = 0;
    return Scaffold(
      body: IndexedStack(index: _index, children: [for (final t in tabs) t.page]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          for (final t in tabs) NavigationDestination(icon: Icon(t.icon), selectedIcon: Icon(t.activeIcon), label: t.label),
        ],
      ),
    );
  }
}
