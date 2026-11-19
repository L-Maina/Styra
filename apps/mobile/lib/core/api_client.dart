import 'dart:io';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import 'config.dart';

typedef Json = Map<String, dynamic>;

class ApiException implements Exception {
  ApiException(this.message, {this.status, this.code});
  final String message;
  final int? status;
  final String? code;
  bool get isUnauthorized => status == 401;
  @override
  String toString() => message;
}

/// A paginated list as returned by the backend's `paginatedResponse`.
class Paged<T> {
  Paged(this.items, {this.page = 1, this.totalPages = 1, this.total = 0});
  final List<T> items;
  final int page;
  final int totalPages;
  final int total;
  bool get hasMore => page < totalPages;
}

/// Talks to the Styra Next.js API.
///
/// The backend authenticates with an httpOnly `styra-token` cookie and protects
/// state-changing requests with a double-submit `csrf-token` cookie, so we keep
/// a persistent cookie jar and echo the CSRF cookie back as `X-CSRF-Token`.
class ApiClient {
  ApiClient._(this._dio, this._jar);

  final Dio _dio;
  final PersistCookieJar _jar;
  void Function()? onUnauthorized;

  static Future<ApiClient> create() async {
    final dir = await getApplicationSupportDirectory();
    final jar = PersistCookieJar(storage: FileStorage('${dir.path}/cookies'));
    final dio = Dio(BaseOptions(
      baseUrl: '${AppConfig.apiBaseUrl}/api',
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 20),
      contentType: Headers.jsonContentType,
      validateStatus: (_) => true,
    ));
    final client = ApiClient._(dio, jar);
    dio.interceptors.add(CookieManager(jar));
    dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) async {
      if (const ['POST', 'PUT', 'PATCH', 'DELETE'].contains(options.method.toUpperCase())) {
        final csrf = await client._csrfToken();
        if (csrf != null) options.headers['X-CSRF-Token'] = csrf;
      }
      handler.next(options);
    }));
    return client;
  }

  Future<String?> _csrfToken() async {
    final cookies = await _jar.loadForRequest(Uri.parse(AppConfig.apiBaseUrl));
    for (final c in cookies) {
      if (c.name == 'csrf-token') return Uri.decodeComponent(c.value);
    }
    return null;
  }

  Future<bool> hasSessionCookie() async {
    final cookies = await _jar.loadForRequest(Uri.parse(AppConfig.apiBaseUrl));
    return cookies.any((c) => c.name == 'styra-token');
  }

  Future<void> clearSession() => _jar.deleteAll();

  Future<dynamic> _send(String method, String path, {Object? body, Map<String, dynamic>? query, bool retried = false}) async {
    Response res;
    try {
      res = await _dio.request(
        path,
        data: body,
        queryParameters: query?..removeWhere((_, v) => v == null || v == ''),
        options: Options(method: method),
      );
    } on DioException catch (e) {
      if (e.error is SocketException || e.type == DioExceptionType.connectionError) {
        throw ApiException('No connection. Check your internet and try again.');
      }
      if (e.type == DioExceptionType.connectionTimeout || e.type == DioExceptionType.receiveTimeout) {
        throw ApiException('Request timed out. Please try again.');
      }
      throw ApiException(e.message ?? 'Network error');
    }

    final data = res.data is Map ? Json.from(res.data as Map) : <String, dynamic>{};
    final status = res.statusCode ?? 0;
    final code = data['code']?.toString();

    // CSRF cookie expired — refresh it via /auth/me once and retry.
    if (status == 403 && (code == 'CSRF_TOKEN_MISSING' || code == 'CSRF_TOKEN_INVALID') && !retried) {
      await _dio.get('/auth/me');
      return _send(method, path, body: body, query: query, retried: true);
    }
    if (status == 401) onUnauthorized?.call();
    if (status >= 400 || data['success'] == false) {
      throw ApiException(data['error']?.toString() ?? data['message']?.toString() ?? 'Something went wrong ($status)',
          status: status, code: code);
    }
    return data;
  }

  /// Returns the `data` field of a `{ success, data }` response.
  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async => (await _send('GET', path, query: query))['data'];
  Future<dynamic> post(String path, [Object? body]) async => (await _send('POST', path, body: body ?? {}))['data'];
  Future<dynamic> patch(String path, [Object? body]) async => (await _send('PATCH', path, body: body ?? {}))['data'];
  Future<dynamic> put(String path, [Object? body]) async => (await _send('PUT', path, body: body ?? {}))['data'];
  Future<dynamic> delete(String path, [Object? body]) async => (await _send('DELETE', path, body: body))['data'];

  /// For paginated endpoints: `{ success, data: [...], pagination: {...} }`.
  Future<Paged<T>> getPage<T>(String path, T Function(Json) parse, {Map<String, dynamic>? query}) async {
    final raw = await _send('GET', path, query: query);
    final list = asList(raw['data']).map((e) => parse(asMap(e))).toList();
    final p = asMap(raw['pagination']);
    return Paged(list,
        page: asInt(p['page'], 1), totalPages: asInt(p['totalPages'], 1), total: asInt(p['total'], list.length));
  }

  /// Multipart upload to /api/upload. Returns the uploaded file URL.
  Future<String> upload(File file, {String type = 'avatar'}) async {
    final form = FormData.fromMap({'file': await MultipartFile.fromFile(file.path), 'type': type});
    final data = await _send('POST', '/upload', body: form);
    final d = asMap(data['data']);
    return (d['url'] ?? d['secure_url'] ?? '').toString();
  }
}

// ---- Tolerant JSON helpers (backend returns some JSON as strings / loose types) ----
Json asMap(dynamic v) => v is Map ? Json.from(v) : <String, dynamic>{};
List<dynamic> asList(dynamic v) {
  if (v is List) return v;
  if (v is Map) {
    for (final k in const ['items', 'data', 'results', 'list']) {
      if (v[k] is List) return v[k] as List;
    }
  }
  return const [];
}

int asInt(dynamic v, [int fallback = 0]) => v is num ? v.toInt() : int.tryParse('$v') ?? fallback;
double asDouble(dynamic v, [double fallback = 0]) => v is num ? v.toDouble() : double.tryParse('$v') ?? fallback;
String? asStr(dynamic v) => v == null ? null : v.toString();
bool asBool(dynamic v) => v == true || v == 'true' || v == 1;
DateTime? asDate(dynamic v) => v == null ? null : DateTime.tryParse(v.toString())?.toLocal();

final apiProvider = Provider<ApiClient>((ref) => throw UnimplementedError('Overridden in main()'));
