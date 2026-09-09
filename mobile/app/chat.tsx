import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch } from '../lib/api';
import { getAccessToken, getMe, type User } from '../lib/auth';
import { theme, shadow } from '../lib/theme';

type Message = { id: string; role: 'user' | 'assistant'; content: string };
type ChatResponse = { ok: boolean; answer: string; conversation_id: number; credits: number };

export default function Chat() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => { getMe().then((current) => { if (!current) router.replace('/login'); else { setUser(current); Animated.timing(appear, { toValue: 1, duration: 350, useNativeDriver: true }).start(); } }); }, [router, appear]);

  async function send() {
    const message = text.trim();
    if (!message || busy) return;
    const token = await getAccessToken();
    if (!token) return router.replace('/login');
    setText('');
    setMessages((items) => [...items, { id: `${Date.now()}-u`, role: 'user', content: message }]);
    setBusy(true);
    try {
      const result = await apiFetch<ChatResponse>('/api/chat', { method: 'POST', accessToken: token, body: JSON.stringify({ message, conversation_id: conversationId || undefined, language: 'ar' }) });
      setConversationId(result.conversation_id);
      setUser((current) => current ? { ...current, credits: result.credits } : current);
      setMessages((items) => [...items, { id: `${Date.now()}-a`, role: 'assistant', content: result.answer }]);
    } catch (error) {
      setMessages((items) => [...items, { id: `${Date.now()}-e`, role: 'assistant', content: error instanceof Error ? error.message : 'تعذر الحصول على الرد.' }]);
    } finally { setBusy(false); }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Animated.View style={[styles.header, { opacity: appear }]}>
        <Pressable style={({ pressed }) => [styles.backButton, pressed && styles.pressed]} onPress={() => router.back()}><Text style={styles.back}>‹</Text></Pressable>
        <View style={styles.headerInfo}><View style={styles.logoRow}><View style={styles.dot} /><Text style={styles.logo}>STAR AI</Text></View><Text style={styles.credits}>{user?.credits ?? 0} Credits</Text></View>
        <View style={styles.statusPill}><Text style={styles.statusText}>AI</Text></View>
      </Animated.View>
      <FlatList data={messages} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled" ListEmptyComponent={<View style={styles.empty}><View style={styles.aiIcon}><Text style={styles.aiIconText}>S</Text></View><Text style={styles.emptyTitle}>كيف أساعدك؟</Text><Text style={styles.emptyText}>اسأل STAR AI عن أي شيء، وسأساعدك خطوة بخطوة.</Text><View style={styles.suggestion}><Text style={styles.suggestionText}>اكتب سؤالك هنا للبدء</Text></View></View>} renderItem={({ item }) => <View style={[styles.messageRow, item.role === 'user' && styles.userRow]}><View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}><Text style={[styles.message, item.role === 'user' && styles.userMessage]}>{item.content}</Text></View></View>} />
      <View style={styles.composerWrap}>
        <View style={styles.composer}>
          <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="اكتب رسالتك..." placeholderTextColor={theme.textDim} multiline maxLength={8000} />
          <Pressable style={({ pressed }) => [styles.send, pressed && styles.pressed, (!text.trim() || busy) && styles.sendDisabled]} onPress={send} disabled={busy || !text.trim()}><Text style={styles.sendText}>{busy ? '…' : '↑'}</Text></Pressable>
        </View>
        <Text style={styles.disclaimer}>STAR AI قد يخطئ أحيانًا، تحقّق من المعلومات المهمة.</Text>
      </View>
      {busy && <View style={styles.loading}><ActivityIndicator color={theme.white} size="small" /><Text style={styles.loadingText}>STAR AI يفكر...</Text></View>}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 55, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: theme.line, backgroundColor: '#08080b' },
  backButton: { width: 42, height: 42, borderRadius: 13, borderWidth: 1, borderColor: theme.line, alignItems: 'center', justifyContent: 'center' },
  back: { color: theme.text, fontSize: 34, lineHeight: 30, marginTop: -2 },
  headerInfo: { flex: 1 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.white },
  logo: { color: theme.text, fontSize: 14, fontWeight: '900', letterSpacing: 2.2 },
  credits: { color: theme.textMuted, fontSize: 11, marginTop: 4 },
  statusPill: { borderWidth: 1, borderColor: theme.line, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: theme.surface },
  statusText: { color: theme.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  list: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14, flexGrow: 1, justifyContent: 'flex-end' },
  empty: { alignItems: 'center', paddingHorizontal: 22, marginBottom: 40 },
  aiIcon: { width: 58, height: 58, borderRadius: 19, backgroundColor: theme.white, alignItems: 'center', justifyContent: 'center', marginBottom: 18, ...shadow },
  aiIconText: { color: theme.black, fontSize: 25, fontWeight: '900' },
  emptyTitle: { color: theme.text, fontSize: 29, fontWeight: '800', letterSpacing: -0.8 },
  emptyText: { color: theme.textMuted, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 9 },
  suggestion: { marginTop: 18, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 99 },
  suggestionText: { color: theme.textDim, fontSize: 12 },
  messageRow: { alignItems: 'flex-start', marginVertical: 5 },
  userRow: { alignItems: 'flex-end' },
  bubble: { maxWidth: '88%', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 18 },
  userBubble: { backgroundColor: theme.white, borderBottomRightRadius: 5 },
  aiBubble: { backgroundColor: theme.surfaceElevated, borderWidth: 1, borderColor: theme.line, borderBottomLeftRadius: 5 },
  message: { color: theme.text, fontSize: 16, lineHeight: 24 },
  userMessage: { color: theme.black },
  composerWrap: { paddingHorizontal: 12, paddingTop: 9, paddingBottom: Platform.OS === 'ios' ? 10 : 8, borderTopWidth: 1, borderTopColor: theme.line, backgroundColor: '#08080b' },
  composer: { minHeight: 56, maxHeight: 135, flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 5, borderRadius: 19, borderWidth: 1, borderColor: '#2a2a32', backgroundColor: theme.surface, ...shadow },
  input: { flex: 1, minHeight: 46, maxHeight: 120, color: theme.text, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, textAlign: 'right' },
  send: { width: 46, height: 46, borderRadius: 15, backgroundColor: theme.white, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.38 },
  sendText: { color: theme.black, fontSize: 23, fontWeight: '900', marginTop: -2 },
  disclaimer: { color: theme.textDim, fontSize: 9, textAlign: 'center', marginTop: 7 },
  loading: { position: 'absolute', alignSelf: 'center', bottom: 102, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#15151a', borderWidth: 1, borderColor: theme.line, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 99 },
  loadingText: { color: theme.textMuted, fontSize: 11 },
  pressed: { opacity: 0.65, transform: [{ scale: 0.97 }] },
});
