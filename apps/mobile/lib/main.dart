import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/api_client.dart';
import 'core/theme.dart';
import 'router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final api = await ApiClient.create();
  runApp(ProviderScope(overrides: [apiProvider.overrideWithValue(api)], child: const StyraApp()));
}

final themeModeProvider = StateProvider<ThemeMode>((ref) => ThemeMode.dark);

class StyraApp extends ConsumerWidget {
  const StyraApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'Styra',
      debugShowCheckedModeBanner: false,
      theme: styraLightTheme,
      darkTheme: styraDarkTheme,
      themeMode: ref.watch(themeModeProvider),
      routerConfig: ref.watch(routerProvider),
    );
  }
}
