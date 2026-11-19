/// Build-time configuration. Override with:
///   flutter run --dart-define=API_BASE_URL=https://your-styra-domain.com
class AppConfig {
  AppConfig._();

  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    // Android emulator reaches the host machine's localhost via 10.0.2.2.
    defaultValue: 'http://10.0.2.2:3000',
  );

  static const currency = String.fromEnvironment('CURRENCY', defaultValue: 'KES');
}
