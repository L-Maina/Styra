import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/design_tokens.dart';
import '../../core/format.dart';
import '../../models/models.dart';
import '../../state/auth.dart';
import '../../state/data.dart';
import '../../widgets/common.dart';

class ConversationsScreen extends ConsumerWidget {
  const ConversationsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(conversationsProvider);
    final me = ref.watch(currentUserProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Messages')),
      body: AsyncView(
        value: async,
        onRefresh: () async => ref.invalidate(conversationsProvider),
        builder: (p) => p.items.isEmpty
            ? const EmptyState(icon: Icons.chat_bubble_outline, title: 'No conversations yet', message: 'Message a business from its profile or a booking.')
            : ListView.separated(
                itemCount: p.items.length,
                separatorBuilder: (_, __) => const Divider(height: 1, indent: 72),
                itemBuilder: (_, i) {
                  final c = p.items[i];
                  final other = c.other(me?.id ?? '');
                  final name = asStr(other['name']) ?? asStr(asMap(c.raw['business'])['name']) ?? 'Conversation';
                  return ListTile(
                    leading: Avatar(url: asStr(other['avatar']), name: name, size: 46),
                    title: Text(name, style: TextStyle(fontWeight: c.unread > 0 ? FontWeight.w700 : FontWeight.w500)),
                    subtitle: Text(c.lastMessage ?? '', maxLines: 1, overflow: TextOverflow.ellipsis),
                    trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Text(timeAgo(c.lastMessageAt), style: const TextStyle(fontSize: 11)),
                      if (c.unread > 0) Padding(padding: const EdgeInsets.only(top: 4), child: Badge(label: Text('${c.unread}'))),
                    ]),
                    onTap: () => context.push('/chat/${c.id}', extra: {...other, 'name': name}).then((_) => ref.invalidate(conversationsProvider)),
                  );
                },
              ),
      ),
    );
  }
}

/// Conversation thread. Polls for new messages every 4s while open.
// TODO(realtime): subscribe to Pusher channel `chat-<conversationId>` instead of polling.
class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key, required this.conversationId, this.other = const {}});
  final String conversationId;
  final Map<String, dynamic> other;
  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  List<ChatMessage> _messages = [];
  Json _conversation = {};
  bool _loading = true, _sending = false;
  Object? _error;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(const Duration(seconds: 4), (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _timer?.cancel();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    try {
      final raw = await ref.read(apiProvider).get('/conversations/${widget.conversationId}', query: {'limit': 100});
      final m = asMap(raw);
      final list = (raw is List ? raw : asList(m['messages'] ?? m['data'])).map((e) => ChatMessage(asMap(e))).toList()
        ..sort((a, b) => (a.createdAt ?? DateTime(0)).compareTo(b.createdAt ?? DateTime(0)));
      if (!mounted) return;
      final grew = list.length != _messages.length;
      setState(() {
        _messages = list;
        if (m['conversation'] is Map) _conversation = asMap(m['conversation']);
        _loading = false;
        _error = null;
      });
      if (grew) _toBottom();
    } catch (e) {
      if (mounted && !silent) {
        setState(() {
          _loading = false;
          _error = e;
        });
      }
    }
  }

  void _toBottom() => WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) _scroll.animateTo(_scroll.position.maxScrollExtent, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
      });

  String? _receiverId(String meId) {
    final id = asStr(widget.other['id']);
    if (id != null && id != meId) return id;
    final p1 = asStr(_conversation['participant1']), p2 = asStr(_conversation['participant2']);
    if (p1 != null && p1 != meId) return p1;
    if (p2 != null && p2 != meId) return p2;
    return _messages.where((m) => m.senderId != meId).firstOrNull?.senderId;
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    final me = ref.read(currentUserProvider);
    if (text.isEmpty || me == null) return;
    final receiver = _receiverId(me.id);
    if (receiver == null) return showError(context, 'Couldn\'t determine who to send this to.');
    setState(() => _sending = true);
    final ok = await guard(context, () async {
      await ref.read(apiProvider).post('/conversations/${widget.conversationId}', {
        'conversationId': widget.conversationId,
        'receiverId': receiver,
        'content': text,
      });
    });
    if (ok) {
      _input.clear();
      await _load(silent: true);
    }
    if (mounted) setState(() => _sending = false);
  }

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(currentUserProvider);
    final name = asStr(widget.other['name']) ?? 'Chat';
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(children: [Avatar(url: asStr(widget.other['avatar']), name: name, size: 34), const SizedBox(width: 10), Expanded(child: Text(name, overflow: TextOverflow.ellipsis))]),
      ),
      body: Column(children: [
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _error != null
                  ? EmptyState(icon: Icons.cloud_off, title: 'Couldn\'t load messages', message: '$_error', action: FilledButton(onPressed: _load, child: const Text('Retry')))
                  : _messages.isEmpty
                      ? const EmptyState(icon: Icons.waving_hand_outlined, title: 'Say hello 👋')
                      : ListView.builder(
                          controller: _scroll,
                          padding: const EdgeInsets.all(12),
                          itemCount: _messages.length,
                          itemBuilder: (_, i) {
                            final m = _messages[i];
                            final mine = m.senderId == me?.id;
                            return Align(
                              alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
                              child: Container(
                                constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                                margin: const EdgeInsets.symmetric(vertical: 3),
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                                decoration: BoxDecoration(
                                  gradient: mine ? StyraTokens.brandGradient : null,
                                  color: mine ? null : Theme.of(context).cardTheme.color,
                                  borderRadius: BorderRadius.circular(18),
                                ),
                                child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                                  Text(m.content, style: TextStyle(color: mine ? Colors.white : null)),
                                  const SizedBox(height: 2),
                                  Text(timeOnly(m.createdAt), style: TextStyle(fontSize: 10, color: mine ? Colors.white70 : null)),
                                ]),
                              ),
                            );
                          },
                        ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 6, 8, 8),
            child: Row(children: [
              Expanded(
                child: TextField(
                  controller: _input,
                  minLines: 1,
                  maxLines: 5,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(hintText: 'Message', contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 10)),
                ),
              ),
              IconButton.filled(onPressed: _sending ? null : _send, icon: const Icon(Icons.send)),
            ]),
          ),
        ),
      ]),
    );
  }
}
