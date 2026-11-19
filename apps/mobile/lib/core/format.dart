import 'package:intl/intl.dart';

import 'config.dart';

final _money = NumberFormat.currency(symbol: '${AppConfig.currency} ', decimalDigits: 0);
String money(num v) => _money.format(v);

String shortDate(DateTime? d) => d == null ? '' : DateFormat('EEE, d MMM').format(d);
String longDate(DateTime? d) => d == null ? '' : DateFormat('EEE, d MMM yyyy').format(d);
String dateTime(DateTime? d) => d == null ? '' : DateFormat('d MMM, HH:mm').format(d);
String timeOnly(DateTime? d) => d == null ? '' : DateFormat('HH:mm').format(d);
String isoDate(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

String timeAgo(DateTime? d) {
  if (d == null) return '';
  final diff = DateTime.now().difference(d);
  if (diff.inMinutes < 1) return 'now';
  if (diff.inHours < 1) return '${diff.inMinutes}m';
  if (diff.inDays < 1) return '${diff.inHours}h';
  if (diff.inDays < 7) return '${diff.inDays}d';
  return DateFormat('d MMM').format(d);
}

String duration(int minutes) {
  if (minutes < 60) return '$minutes min';
  final h = minutes ~/ 60, m = minutes % 60;
  return m == 0 ? '${h}h' : '${h}h ${m}m';
}

String titleCase(String s) => s
    .replaceAll('_', ' ')
    .split(' ')
    .where((w) => w.isNotEmpty)
    .map((w) => w[0].toUpperCase() + w.substring(1).toLowerCase())
    .join(' ');
