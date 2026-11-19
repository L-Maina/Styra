import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_client.dart';
import '../models/models.dart';
import 'auth.dart';

/// Marketplace search filters.
class BusinessQuery {
  const BusinessQuery({this.query, this.category, this.city, this.minRating, this.lat, this.lng, this.radius, this.limit = 30});
  final String? query, category, city;
  final double? minRating, lat, lng, radius;
  final int limit;

  Map<String, dynamic> toParams() => {
        'query': query,
        'category': category,
        'city': city,
        'minRating': minRating,
        'lat': lat,
        'lng': lng,
        'radius': radius,
        'limit': limit,
      };

  BusinessQuery copyWith({String? query, String? category, bool clearCategory = false, String? city, double? minRating}) => BusinessQuery(
        query: query ?? this.query,
        category: clearCategory ? null : category ?? this.category,
        city: city ?? this.city,
        minRating: minRating ?? this.minRating,
        lat: lat,
        lng: lng,
        radius: radius,
        limit: limit,
      );

  @override
  bool operator ==(Object o) => o is BusinessQuery && o.toParams().toString() == toParams().toString();
  @override
  int get hashCode => toParams().toString().hashCode;
}

const categories = <String, String>{
  'barber': 'Barber',
  'salon': 'Salon',
  'spa': 'Spa',
  'nails': 'Nails',
  'makeup': 'Makeup',
  'braids': 'Braids',
  'massage': 'Massage',
  'skincare': 'Skincare',
};

final businessesProvider = FutureProvider.autoDispose.family<Paged<Business>, BusinessQuery>((ref, q) {
  return ref.watch(apiProvider).getPage('/businesses', Business.new, query: q.toParams());
});

final businessProvider = FutureProvider.autoDispose.family<Business, String>((ref, id) async {
  final api = ref.watch(apiProvider);
  final b = Business(asMap(await api.get('/businesses/$id')));
  // Ensure services/staff/reviews are present even if the detail endpoint omits them.
  final raw = Map<String, dynamic>.from(b.raw);
  final futures = <Future<void>>[];
  if (b.services.isEmpty) {
    futures.add(api.get('/services', query: {'businessId': id, 'limit': 100}).then((v) { raw['services'] = asList(v); }).catchError((Object _) {}));
  }
  if (b.staff.isEmpty) {
    futures.add(api.get('/staff', query: {'businessId': id}).then((v) { raw['staff'] = asList(v); }).catchError((Object _) {}));
  }
  if (b.reviews.isEmpty) {
    futures.add(api.get('/reviews', query: {'businessId': id}).then((v) { raw['reviews'] = asList(v); }).catchError((Object _) {}));
  }
  await Future.wait(futures);
  return Business(raw);
});

final bookingsProvider = FutureProvider.autoDispose.family<Paged<Booking>, String?>((ref, status) {
  return ref.watch(apiProvider).getPage('/bookings', Booking.new, query: {'status': status, 'limit': 50});
});

final bookingProvider = FutureProvider.autoDispose.family<Booking, String>((ref, id) async {
  return Booking(asMap(await ref.watch(apiProvider).get('/bookings/$id')));
});

final notificationsProvider = FutureProvider.autoDispose<Paged<AppNotification>>((ref) {
  return ref.watch(apiProvider).getPage('/notifications', AppNotification.new, query: {'limit': 50});
});

final unreadCountProvider = FutureProvider.autoDispose<int>((ref) async {
  final p = await ref.watch(apiProvider).getPage('/notifications', AppNotification.new, query: {'unread': 'true', 'limit': 1});
  return p.total;
});

final conversationsProvider = FutureProvider.autoDispose<Paged<Conversation>>((ref) {
  return ref.watch(apiProvider).getPage('/conversations', Conversation.new, query: {'limit': 50});
});

/// Full profile (includes the owner's business, when present).
final profileProvider = FutureProvider.autoDispose<Json>((ref) async => asMap(await ref.watch(apiProvider).get('/users')));

/// The signed-in owner's business, or null if they haven't onboarded yet.
final myBusinessProvider = FutureProvider.autoDispose<Business?>((ref) async {
  // /auth/me sets businessId for owners (most recent business).
  final fromMe = ref.watch(currentUserProvider)?.businessId;
  if (fromMe != null) return ref.watch(businessProvider(fromMe).future);
  final p = await ref.watch(profileProvider.future);
  Json b = asMap(p['business']);
  if (b.isEmpty) {
    final list = asList(p['businesses']);
    if (list.isNotEmpty) b = asMap(list.first);
  }
  if (b['id'] == null) return null;
  return ref.watch(businessProvider(b['id'].toString()).future);
});
