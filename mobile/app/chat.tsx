import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch } from '../lib/api';
import { getAccessToken, getMe, type User } from '../lib/auth';

type Message = { id: string; role: 'user' | 'assistant'; content: string };
type ChatResponse = { ok: boolean; answer: string; conversation_id: number; credits: number };

export default function Chat() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);

  useEffect(() => { getMe().then((current) => { if (!current) router.replace('/login'); else setUser(current); }); }, [router]);

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
      <View style={styles.header}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹</Text></Pressable><View><Text style={styles.logo}>STAR AI</Text><Text style={styles.credits}>{user?.credits ?? 0} Credits</Text></View></View>
      <FlatList data={messages} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>كيف أساعدك؟</Text><Text style={styles.emptyText}>اسأل STAR AI عن أي شيء.</Text></View>} renderItem={({ item }) => <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}><Text style={[styles.message, item.role === 'user' && styles.userMessage]}>{item.content}</Text></View>} />
      <View style={styles.composer}><TextInput style={styles.input} value={text} onChangeText={setText} placeholder="اكتب رسالتك..." placeholderTextColor="#6d6d76" multiline /><Pressable style={styles.send} onPress={send} disabled={busy}><Text style={styles.sendText}>{busy ? '…' : '↑'}</Text></Pressable></View>
      {busy && <ActivityIndicator style={styles.spinner} color="#fff" />}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07070a' }, header: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20, paddingTop: 55, borderBottomWidth: 1, borderBottomColor: '#1d1d24' }, back: { color: '#fff', fontSize: 36, lineHeight: 32 }, logo: { color: '#fff', fontWeight: '800', letterSpacing: 2 }, credits: { color: '#858590', fontSize: 12, marginTop: 3 }, list: { padding: 18, gap: 10, flexGrow: 1, justifyContent: 'flex-end' }, empty: { alignItems: 'center', marginBottom: 80 }, emptyTitle: { color: '#fff', fontSize: 30, fontWeight: '800' }, emptyText: { color: '#858590', marginTop: 8 }, bubble: { maxWidth: '86%', padding: 13, borderRadius: 16 }, userBubble: { alignSelf: 'flex-end', backgroundColor: '#fff' }, aiBubble: { alignSelf: 'flex-start', backgroundColor: '#15151b' }, message: { color: '#fff', fontSize: 16, lineHeight: 23 }, userMessage: { color: '#08080a' }, composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: '#1d1d24' }, input: { flex: 1, minHeight: 48, maxHeight: 120, backgroundColor: '#121218', borderRadius: 16, color: '#fff', paddingHorizontal: 15, paddingVertical: 12, fontSize: 16 }, send: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, sendText: { color: '#08080a', fontSize: 24, fontWeight: '800' }, spinner: { position: 'absolute', bottom: 85, alignSelf: 'center' }
});
