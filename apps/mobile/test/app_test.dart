import 'package:flutter_test/flutter_test.dart';
import 'package:styra_mobile/core/api_client.dart';
import 'package:styra_mobile/core/format.dart';
import 'package:styra_mobile/models/models.dart';

void main() {
  group('roles', () {
    test('normalises legacy role names like the backend', () {
      expect(parseRole('CUSTOMER'), UserRole.customer);
      expect(parseRole('client'), UserRole.customer);
      expect(parseRole('BUSINESS'), UserRole.businessOwner);
      expect(parseRole('provider'), UserRole.businessOwner);
      expect(parseRole('ADMIN'), UserRole.admin);
      expect(parseRole(null), UserRole.customer);
    });
  });

  group('models tolerate loose JSON', () {
    test('booking', () {
      final b = Booking({
        'id': 'b1',
        'date': '2026-12-01T00:00:00.000Z',
        'time': '14:30',
        'status': 'CONFIRMED',
        'totalPrice': '1500',
        'business': {'id': 'x', 'name': 'Kinyozi', 'ownerId': 'o1'},
        'payments': [
          {'status': 'completed'}
        ],
      });
      expect(b.status, 'CONFIRMED'); // canonical UPPERCASE, see CLAUDE.md
      expect(b.totalPrice, 1500);
      expect(b.businessName, 'Kinyozi');
      expect(b.isPaid, isTrue);
      expect(b.when, DateTime(2026, 12, 1, 14, 30));
    });

    test('business review count falls back to _count', () {
      final b = Business({'id': '1', 'rating': 4.5, '_count': {'reviews': 12}});
      expect(b.reviewCount, 12);
      expect(b.rating, 4.5);
    });

    test('asList unwraps common envelope keys', () {
      expect(asList({'items': [1, 2]}), [1, 2]);
      expect(asList(null), isEmpty);
    });
  });

  test('formatting', () {
    expect(duration(45), '45 min');
    expect(duration(90), '1h 30m');
    expect(titleCase('IN_PROGRESS'), 'In Progress');
  });
}
