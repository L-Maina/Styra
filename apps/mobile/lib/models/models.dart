import '../core/api_client.dart';

enum UserRole { customer, businessOwner, admin }

/// Mirrors src/lib/booking-status.ts on the web: canonical UPPERCASE, older rows lowercase.
String normalizeStatus(String? v) => (v ?? '').trim().replaceAll(RegExp(r'[\s-]+'), '_').toUpperCase();
bool isStatus(String? v, List<String> statuses) => statuses.contains(normalizeStatus(v));
bool isUpcomingStatus(String? v) => isStatus(v, const ['PENDING', 'CONFIRMED', 'IN_PROGRESS']);
bool isDoneStatus(String? v) => isStatus(v, const ['COMPLETED', 'VERIFIED']);

/// Hours the customer has to confirm or report a problem after the provider marks a booking complete.
const verificationWindowHours = 24;

const bookingStatusLabels = {
  'PENDING': 'Pending',
  'CONFIRMED': 'Confirmed',
  'IN_PROGRESS': 'In progress',
  'COMPLETED': 'Awaiting confirmation',
  'VERIFIED': 'Completed',
  'DISPUTED': 'Under review',
  'CANCELLED': 'Cancelled',
  'NO_SHOW': 'No-show',
};

/// Business approval: the admin API accepts APPROVED; stored values may be VERIFIED / AUTO_VERIFIED.
bool isBusinessApproved(String? v) => isStatus(v, const ['APPROVED', 'VERIFIED', 'AUTO_VERIFIED']);

UserRole parseRole(String? r) {
  switch ((r ?? '').toUpperCase()) {
    case 'ADMIN':
      return UserRole.admin;
    case 'BUSINESS_OWNER':
    case 'BUSINESS':
    case 'PROVIDER':
      return UserRole.businessOwner;
    default:
      return UserRole.customer;
  }
}

class AppUser {
  AppUser(this.raw);
  final Json raw;
  String get id => raw['id'].toString();
  String get name => asStr(raw['name']) ?? '';
  String get email => asStr(raw['email']) ?? '';
  String? get phone => asStr(raw['phone']);
  String? get avatar => asStr(raw['avatar']);
  bool get isVerified => asBool(raw['isVerified']);
  /// /auth/me adds BUSINESS_OWNER to `roles` and sets `businessId` once the user owns a business.
  UserRole get role {
    final base = parseRole(asStr(raw['role']));
    if (base == UserRole.admin) return base;
    final roles = asList(raw['roles']).map((r) => r.toString().toUpperCase());
    if (base == UserRole.businessOwner || roles.contains('BUSINESS_OWNER') || raw['businessId'] != null) return UserRole.businessOwner;
    return UserRole.customer;
  }

  String? get businessId => asStr(raw['businessId']);
  String? get businessVerificationStatus => asStr(raw['businessVerificationStatus']);
  String? get rejectionReason => asStr(raw['rejectionReason']);
  String get protectionPlan => asStr(raw['protectionPlan']) ?? 'basic';
  DateTime? get createdAt => asDate(raw['createdAt']);
}

class Business {
  Business(this.raw);
  final Json raw;
  String get id => raw['id'].toString();
  String get ownerId => asStr(raw['ownerId']) ?? '';
  String get name => asStr(raw['name']) ?? 'Business';
  String? get description => asStr(raw['description']);
  String get category => asStr(raw['category']) ?? '';
  String? get address => asStr(raw['address']);
  String? get city => asStr(raw['city']);
  double? get lat => raw['latitude'] == null ? null : asDouble(raw['latitude']);
  double? get lng => raw['longitude'] == null ? null : asDouble(raw['longitude']);
  String? get phone => asStr(raw['phone']);
  String? get email => asStr(raw['email']);
  String? get website => asStr(raw['website']);
  String? get logo => asStr(raw['logo']);
  String? get coverImage => asStr(raw['coverImage']);
  double get rating => asDouble(raw['rating']);
  int get reviewCount => asInt(raw['reviewCount'] ?? asMap(raw['_count'])['reviews']);
  bool get isVerified => asBool(raw['isVerified']);
  bool get isActive => raw['isActive'] == null || asBool(raw['isActive']);
  String? get verificationStatus => asStr(raw['verificationStatus']);
  double? get distanceKm => raw['distance'] == null ? null : asDouble(raw['distance']);
  List<Service> get services => asList(raw['services']).map((e) => Service(asMap(e))).toList();
  List<Staff> get staff => asList(raw['staff']).map((e) => Staff(asMap(e))).toList();
  List<Review> get reviews => asList(raw['reviews']).map((e) => Review(asMap(e))).toList();
  List<String> get portfolio =>
      asList(raw['portfolio']).map((e) => asStr(asMap(e)['image']) ?? '').where((s) => s.isNotEmpty).toList();
  bool get isFavorite => asBool(raw['isFavorite'] ?? raw['isFavorited']);
  String get locationLabel => [address, city].whereType<String>().where((s) => s.isNotEmpty).join(', ');
}

class Service {
  Service(this.raw);
  final Json raw;
  String get id => raw['id'].toString();
  String get businessId => asStr(raw['businessId']) ?? '';
  String get name => asStr(raw['name']) ?? '';
  String? get description => asStr(raw['description']);
  double get price => asDouble(raw['price']);
  int get duration => asInt(raw['duration'], 30);
  String? get category => asStr(raw['category']);
  String? get image => asStr(raw['image'] ?? raw['imageUrl']);
  bool get isActive => raw['isActive'] == null || asBool(raw['isActive']);
}

class Staff {
  Staff(this.raw);
  final Json raw;
  String get id => raw['id'].toString();
  String get name => asStr(raw['name']) ?? '';
  String? get role => asStr(raw['role']);
  String? get avatar => asStr(raw['avatar']);
  String? get bio => asStr(raw['bio']);
  bool get isActive => raw['isActive'] == null || asBool(raw['isActive']);
}

class Review {
  Review(this.raw);
  final Json raw;
  String get id => raw['id'].toString();
  int get rating => asInt(raw['rating']);
  String? get comment => asStr(raw['comment']);
  String get author => asStr(asMap(raw['customer'])['name']) ?? 'Customer';
  String? get authorAvatar => asStr(asMap(raw['customer'])['avatar']);
  String? get businessName => asStr(asMap(raw['business'])['name']);
  DateTime? get createdAt => asDate(raw['createdAt']);
}

class Booking {
  Booking(this.raw);
  final Json raw;
  String get id => raw['id'].toString();
  String get businessId => asStr(raw['businessId']) ?? asStr(asMap(raw['business'])['id']) ?? '';
  String get businessName => asStr(asMap(raw['business'])['name']) ?? 'Business';
  String? get businessOwnerId => asStr(asMap(raw['business'])['ownerId']);
  String? get businessLogo => asStr(asMap(raw['business'])['logo']);
  String get serviceName => asStr(raw['serviceName']) ?? asStr(asMap(raw['service'])['name']) ?? 'Service';
  String? get staffName => asStr(raw['staffName']) ?? asStr(asMap(raw['staff'])['name']);
  String get customerId => asStr(raw['customerId']) ?? '';
  String get customerName => asStr(raw['customerName']) ?? asStr(asMap(raw['customer'])['name']) ?? 'Customer';
  String? get customerPhone => asStr(raw['customerPhone']);
  String get date => asStr(raw['date']) ?? '';
  String get time => asStr(raw['time'] ?? raw['startTime']) ?? '';
  String? get endTime => asStr(raw['endTime']);
  /// Normalised UPPERCASE status (PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, VERIFIED, DISPUTED, CANCELLED, NO_SHOW).
  String get status => normalizeStatus(asStr(raw['status']) ?? 'PENDING');
  String get statusLabel => bookingStatusLabels[status] ?? status;
  DateTime? get completedAt => asDate(raw['completedAt'] ?? raw['updatedAt']);
  DateTime? get verificationDeadline => completedAt?.add(const Duration(hours: verificationWindowHours));
  double get totalPrice => asDouble(raw['totalPrice'] ?? raw['servicePrice']);
  String? get notes => asStr(raw['notes']);
  bool get hasReview => asList(raw['reviews']).isNotEmpty || raw['review'] != null;
  List<Json> get payments => asList(raw['payments']).map(asMap).toList();
  bool get isPaid => payments.any((p) => ['completed', 'held'].contains((asStr(p['status']) ?? '').toLowerCase()));
  DateTime? get when => DateTime.tryParse('${date.length >= 10 ? date.substring(0, 10) : date}T${time.length >= 5 ? time.substring(0, 5) : '00:00'}');
}

class AppNotification {
  AppNotification(this.raw);
  final Json raw;
  String get id => raw['id'].toString();
  String get title => asStr(raw['title']) ?? '';
  String get message => asStr(raw['message']) ?? '';
  String get type => (asStr(raw['type']) ?? 'info').toLowerCase();
  bool get isRead => asBool(raw['isRead']);
  String? get link => asStr(raw['link']);
  DateTime? get createdAt => asDate(raw['createdAt']);
}

class Conversation {
  Conversation(this.raw);
  final Json raw;
  String get id => raw['id'].toString();
  String? get lastMessage => asStr(raw['lastMessage']);
  DateTime? get lastMessageAt => asDate(raw['lastMessageAt'] ?? raw['updatedAt']);
  int get unread => asInt(raw['unreadCount'] ?? raw['unread']);

  /// The participant that isn't [meId].
  Json other(String meId) {
    final u1 = asMap(raw['user1']);
    final u2 = asMap(raw['user2']);
    if (raw['otherUser'] is Map) return asMap(raw['otherUser']);
    if (asStr(raw['participant1']) == meId) return u2.isNotEmpty ? u2 : {'id': raw['participant2']};
    return u1.isNotEmpty ? u1 : {'id': raw['participant1']};
  }
}

class ChatMessage {
  ChatMessage(this.raw);
  final Json raw;
  String get id => raw['id'].toString();
  String get senderId => asStr(raw['senderId']) ?? '';
  String get content => asStr(raw['content']) ?? '';
  DateTime? get createdAt => asDate(raw['createdAt']);
  bool get isRead => asBool(raw['isRead']);
}

class Payment {
  Payment(this.raw);
  final Json raw;
  String get id => raw['id'].toString();
  double get amount => asDouble(raw['amount']);
  String get method => asStr(raw['method']) ?? '';
  String get status => (asStr(raw['status']) ?? 'pending').toLowerCase();
  String get escrowStatus => (asStr(raw['escrowStatus']) ?? '').toLowerCase();
  String? get reference => asStr(raw['transactionRef']);
  String? get description => asStr(raw['description']);
  DateTime? get createdAt => asDate(raw['createdAt']);
}

class WalletTx {
  WalletTx(this.raw);
  final Json raw;
  String get id => raw['id'].toString();
  double get amount => asDouble(raw['amount']);
  String get type => asStr(raw['type']) ?? '';
  String get status => (asStr(raw['status']) ?? '').toLowerCase();
  String? get description => asStr(raw['description']);
  DateTime? get createdAt => asDate(raw['createdAt']);
  bool get isCredit => amount >= 0 && !type.toUpperCase().contains('DEBIT') && !type.toUpperCase().contains('WITHDRAW');
}

class Dispute {
  Dispute(this.raw);
  final Json raw;
  String get id => raw['id'].toString();
  String get status => asStr(raw['status']) ?? '';
  String get reason => asStr(raw['reason'] ?? raw['disputeReason']) ?? '';
  String? get bookingId => asStr(raw['bookingId']);
  String? get resolution => asStr(raw['resolution']);
  double get amount => asDouble(raw['amount'] ?? asMap(raw['booking'])['totalPrice']);
  String get title =>
      asStr(asMap(raw['booking'])['serviceName']) ?? asStr(asMap(raw['business'])['name']) ?? 'Booking dispute';
  DateTime? get createdAt => asDate(raw['createdAt']);
}

class Claim {
  Claim(this.raw);
  final Json raw;
  String get id => raw['id'].toString();
  String get number => asStr(raw['claimNumber']) ?? id;
  String get type => asStr(raw['type']) ?? '';
  String get status => asStr(raw['status']) ?? 'SUBMITTED';
  String get description => asStr(raw['description']) ?? '';
  double get amount => asDouble(raw['amount']);
  String get currency => asStr(raw['currency']) ?? 'KES';
  String? get customerName => asStr(raw['customerName']);
  String? get resolution => asStr(raw['resolution']);
  DateTime? get submittedAt => asDate(raw['submittedAt'] ?? raw['createdAt']);
}
