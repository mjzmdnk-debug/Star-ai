import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { apiFetch } from '../lib/api';
import { getAccessToken, getMe, type User } from '../lib/auth';
import { theme, shadow } from '../lib/theme';

type Language = 'ar' | 'en' | 'tr';
type Message = { id: string; role: 'user' | 'assistant'; content: string; imageUri?: string };
type ChatResponse = { ok: boolean; answer: string; conversation_id: number; credits: number };
type AnalyzeResponse = { ok: boolean; answer: string; credits: number; cost: number };

const languages: Array<{ key: Language; label: string }> = [
  { key: 'ar', label: 'العربية' },
  { key: 'en', label: 'English' },
  { key: 'tr', label: 'Türkçe' },
];

const copy = {
  ar: { back: '‹', credits: 'رصيد', newChat: 'محادثة جديدة', title: 'كيف أساعدك؟', subtitle: 'اسأل STAR AI عن أي شيء، وسأساعدك بخطوات واضحة.', placeholder: 'اكتب رسالتك...', thinking: 'STAR AI يفكر...', disclaimer: 'قد يخطئ STAR AI أحيانًا، تحقّق من المعلومات المهمة.', image: 'تحليل صورة', gallery: 'اختيار صورة', cancel: 'إلغاء', language: 'اللغة' },
  en: { back: '‹', credits: 'Credits', newChat: 'New chat', title: 'How can I help?', subtitle: 'Ask STAR AI anything and get a clear, useful answer.', placeholder: 'Message STAR AI...', thinking: 'STAR AI is thinking...', disclaimer: 'STAR AI can make mistakes. Check important information.', image: 'Analyze image', gallery: 'Choose image', cancel: 'Cancel', language: 'Language' },
  tr: { back: '‹', credits: 'Kredi', newChat: 'Yeni sohbet', title: 'Nasıl yardımcı olabilirim?', subtitle: 'STAR AI\'a her şeyi sor ve net, kullanışlı bir cevap al.', placeholder: 'Mesajını yaz...', thinking: 'STAR AI düşünüyor...', disclaimer: 'STAR AI hata yapabilir. Önemli bilgileri kontrol edin.', image: 'Görsel analiz', gallery: 'Görsel seç', cancel: 'İptal', language: 'Dil' },
};

export default function Chat() {
  const router = useRouter();
  const listRef = useRef<FlatList<Message>>(null);
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [language, setLanguage] = useState<Language>('ar');
  const [showTools, setShowTools] = useState(false);
  const [showLanguages, setShowLanguages] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedMime, setSelectedMime] = useState('image/jpeg');
  const [analyzing, setAnalyzing] = useState(false);
  const t = copy[language];

  useEffect(() => {
    getMe().then((current) => {
      if (!current) router.replace('/login');
      else setUser(current);
    });
  }, [router]);

  useEffect(() => {
    if (messages.length) requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  function startNewChat() {
    setMessages([]);
    setConversationId(null);
    setSelectedImage(null);
    setText('');
  }

  async function send() {
    const message = text.trim();
    if (!message || busy || selectedImage) return;
    const token = await getAccessToken();
    if (!token) return router.replace('/login');
    setText('');
    setShowTools(false);
    setMessages((items) => [...items, { id: `${Date.now()}-u`, role: 'user', content: message }]);
    setBusy(true);
    try {
      const result = await apiFetch<ChatResponse>('/api/chat', {
        method: 'POST',
        accessToken: token,
        body: JSON.stringify({ message, conversation_id: conversationId || undefined, language }),
      });
      setConversationId(result.conversation_id);
      setUser((current) => current ? { ...current, credits: result.credits } : current);
      setMessages((items) => [...items, { id: `${Date.now()}-a`, role: 'assistant', content: result.answer }]);
    } catch (error) {
      setMessages((items) => [...items, { id: `${Date.now()}-e`, role: 'assistant', content: error instanceof Error ? error.message : 'تعذر الحصول على الرد.' }]);
    } finally { setBusy(false); }
  }

  async function chooseImage() {
    setShowTools(false);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.88 });
    if (result.canceled) return;
    const asset = result.assets[0];
    setSelectedImage(asset.uri);
    setSelectedMime(asset.mimeType || 'image/jpeg');
  }

  async function analyzeImage() {
    if (!selectedImage || busy || analyzing) return;
    const token = await getAccessToken();
    if (!token) return router.replace('/login');
    setAnalyzing(true);
    setShowTools(false);
    try {
      const base64 = await FileSystem.readAsStringAsync(selectedImage, { encoding: FileSystem.EncodingType.Base64 });
      const imageData = `data:${selectedMime};base64,${base64}`;
      const question = text.trim();
      setText('');
      setMessages((items) => [...items, { id: `${Date.now()}-img`, role: 'user', content: question || t.image, imageUri: selectedImage }]);
      const result = await apiFetch<AnalyzeResponse>('/api/image-analyze', {
        method: 'POST',
        accessToken: token,
        body: JSON.stringify({ image_data: imageData, question }),
      });
      setUser((current) => current ? { ...current, credits: result.credits } : current);
      setMessages((items) => [...items, { id: `${Date.now()}-analysis`, role: 'assistant', content: result.answer }]);
      setSelectedImage(null);
    } catch (error) {
      Alert.alert('STAR AI', error instanceof Error ? error.message : 'تعذر تحليل الصورة.');
    } finally { setAnalyzing(false); }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} onPress={() => router.back()}><Text style={styles.back}>{t.back}</Text></Pressable>
        <View style={styles.headerInfo}>
          <View style={styles.logoRow}><View style={styles.dot} /><Text style={styles.logo}>STAR AI</Text></View>
          <Text style={styles.credits}>{user?.credits ?? 0} {t.credits}</Text>
        </View>
        <Pressable style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} onPress={startNewChat}><Text style={styles.plus}>＋</Text></Pressable>
      </View>

      <View style={styles.languageBar}>
        <Pressable onPress={() => setShowLanguages((value) => !value)} style={styles.languagePill}><Text style={styles.languagePillText}>{t.language}: {languages.find((item) => item.key === language)?.label}</Text><Text style={styles.chevron}>⌄</Text></Pressable>
        {showLanguages && <Animated.View entering={FadeInDown.duration(180)} style={styles.languageMenu}>
          {languages.map((item) => <Pressable key={item.key} style={[styles.languageItem, item.key === language && styles.languageSelected]} onPress={() => { setLanguage(item.key); setShowLanguages(false); }}><Text style={styles.languageItemText}>{item.label}</Text>{item.key === language && <Text style={styles.check}>✓</Text>}</Pressable>)}
        </Animated.View>}
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<Animated.View entering={FadeInUp.duration(500).springify()} style={styles.empty}><View style={styles.aiIcon}><Text style={styles.aiIconText}>S</Text></View><Text style={styles.emptyTitle}>{t.title}</Text><Text style={styles.emptyText}>{t.subtitle}</Text><View style={styles.suggestion}><Text style={styles.suggestionText}>{t.newChat}</Text></View></Animated.View>}
        renderItem={({ item, index }) => <Animated.View entering={FadeInUp.delay(Math.min(index * 35, 140)).duration(280)} style={[styles.messageRow, item.role === 'user' && styles.userRow]}>
          <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
            {item.imageUri && <Image source={{ uri: item.imageUri }} style={styles.messageImage} />}
            <Text style={[styles.message, item.role === 'user' && styles.userMessage]}>{item.content}</Text>
          </View>
        </Animated.View>}
      />

      {selectedImage && <Animated.View entering={FadeInUp.duration(220)} style={styles.previewCard}>
        <Image source={{ uri: selectedImage }} style={styles.previewImage} />
        <View style={styles.previewInfo}><Text style={styles.previewTitle}>{t.image}</Text><Text style={styles.previewSub}>2 Credits</Text></View>
        <Pressable onPress={() => setSelectedImage(null)} style={styles.removeImage}><Text style={styles.removeText}>×</Text></Pressable>
      </Animated.View>}

      {showTools && <Animated.View entering={FadeInUp.duration(180)} style={styles.toolsPanel}>
        <Pressable style={styles.tool} onPress={chooseImage}><View style={styles.toolIcon}><Text style={styles.toolIconText}>▧</Text></View><Text style={styles.toolText}>{t.gallery}</Text></Pressable>
        <Pressable style={styles.tool} onPress={selectedImage ? analyzeImage : chooseImage}><View style={styles.toolIcon}><Text style={styles.toolIconText}>✦</Text></View><Text style={styles.toolText}>{t.image}</Text></Pressable>
      </Animated.View>}

      <View style={styles.composerWrap}>
        <View style={styles.composer}>
          <Pressable style={({ pressed }) => [styles.toolButton, pressed && styles.pressed]} onPress={() => setShowTools((value) => !value)}><Text style={styles.toolButtonText}>＋</Text></Pressable>
          <TextInput style={styles.input} value={text} onChangeText={setText} placeholder={t.placeholder} placeholderTextColor={theme.textDim} multiline maxLength={8000} textAlign="right" onSubmitEditing={() => { if (Platform.OS !== 'ios') send(); }} />
          <Pressable style={({ pressed }) => [styles.send, pressed && styles.pressed, ((!text.trim() && !selectedImage) || busy || analyzing) && styles.sendDisabled]} onPress={selectedImage ? analyzeImage : send} disabled={busy || analyzing || (!text.trim() && !selectedImage)}><Text style={styles.sendText}>{busy || analyzing ? '…' : '↑'}</Text></Pressable>
        </View>
        <Text style={styles.disclaimer}>{t.disclaimer}</Text>
      </View>
      {(busy || analyzing) && <Animated.View entering={FadeInUp.duration(180)} style={styles.loading}><ActivityIndicator color={theme.white} size="small" /><Text style={styles.loadingText}>{analyzing ? t.image : t.thinking}</Text></Animated.View>}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: theme.line, backgroundColor: '#08080b' },
  iconButton: { width: 42, height: 42, borderRadius: 13, borderWidth: 1, borderColor: theme.line, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface },
  back: { color: theme.text, fontSize: 34, lineHeight: 30, marginTop: -2 },
  plus: { color: theme.text, fontSize: 24, fontWeight: '300' },
  headerInfo: { flex: 1 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.white },
  logo: { color: theme.text, fontSize: 14, fontWeight: '900', letterSpacing: 2.2 },
  credits: { color: theme.textMuted, fontSize: 11, marginTop: 4 },
  languageBar: { position: 'relative', zIndex: 20, paddingHorizontal: 16, paddingTop: 10, alignItems: 'flex-end' },
  languagePill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 7 },
  languagePillText: { color: theme.textMuted, fontSize: 10, fontWeight: '700' },
  chevron: { color: theme.textDim, fontSize: 12 },
  languageMenu: { position: 'absolute', right: 16, top: 43, width: 145, borderWidth: 1, borderColor: theme.line, borderRadius: 15, backgroundColor: '#111116', padding: 5, ...shadow },
  languageItem: { minHeight: 38, borderRadius: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  languageSelected: { backgroundColor: theme.surfaceElevated },
  languageItemText: { color: theme.text, fontSize: 12 },
  check: { color: theme.text, fontSize: 13, fontWeight: '800' },
  list: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, flexGrow: 1, justifyContent: 'flex-end' },
  empty: { alignItems: 'center', paddingHorizontal: 22, marginBottom: 36 },
  aiIcon: { width: 62, height: 62, borderRadius: 20, backgroundColor: theme.white, alignItems: 'center', justifyContent: 'center', marginBottom: 18, ...shadow },
  aiIconText: { color: theme.black, fontSize: 27, fontWeight: '900' },
  emptyTitle: { color: theme.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.9 },
  emptyText: { color: theme.textMuted, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 9 },
  suggestion: { marginTop: 18, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 99 },
  suggestionText: { color: theme.textDim, fontSize: 11 },
  messageRow: { alignItems: 'flex-start', marginVertical: 5 },
  userRow: { alignItems: 'flex-end' },
  bubble: { maxWidth: '90%', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 18 },
  userBubble: { backgroundColor: theme.white, borderBottomRightRadius: 5 },
  aiBubble: { backgroundColor: theme.surfaceElevated, borderWidth: 1, borderColor: theme.line, borderBottomLeftRadius: 5 },
  message: { color: theme.text, fontSize: 16, lineHeight: 24, textAlign: 'right' },
  userMessage: { color: theme.black },
  messageImage: { width: 220, height: 180, borderRadius: 13, marginBottom: 9 },
  previewCard: { marginHorizontal: 12, marginBottom: 8, borderRadius: 16, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface, padding: 7, flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewImage: { width: 52, height: 52, borderRadius: 11 },
  previewInfo: { flex: 1 },
  previewTitle: { color: theme.text, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  previewSub: { color: theme.textMuted, fontSize: 10, marginTop: 4, textAlign: 'right' },
  removeImage: { width: 30, height: 30, borderRadius: 10, backgroundColor: theme.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: theme.textMuted, fontSize: 20 },
  toolsPanel: { marginHorizontal: 12, marginBottom: 8, borderRadius: 18, borderWidth: 1, borderColor: theme.line, backgroundColor: '#101015', padding: 8, flexDirection: 'row', gap: 8 },
  tool: { flex: 1, minHeight: 72, borderRadius: 13, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, alignItems: 'center', justifyContent: 'center', gap: 6 },
  toolIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: theme.white, alignItems: 'center', justifyContent: 'center' },
  toolIconText: { color: theme.black, fontSize: 15, fontWeight: '900' },
  toolText: { color: theme.textMuted, fontSize: 10, fontWeight: '700' },
  composerWrap: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 10 : 8, borderTopWidth: 1, borderTopColor: theme.line, backgroundColor: '#08080b' },
  composer: { minHeight: 57, maxHeight: 135, flexDirection: 'row', alignItems: 'flex-end', gap: 7, padding: 5, borderRadius: 19, borderWidth: 1, borderColor: '#2a2a32', backgroundColor: theme.surface, ...shadow },
  toolButton: { width: 45, height: 45, borderRadius: 14, backgroundColor: theme.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  toolButtonText: { color: theme.text, fontSize: 23, fontWeight: '300' },
  input: { flex: 1, minHeight: 46, maxHeight: 120, color: theme.text, paddingHorizontal: 8, paddingVertical: 11, fontSize: 16 },
  send: { width: 46, height: 46, borderRadius: 15, backgroundColor: theme.white, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.35 },
  sendText: { color: theme.black, fontSize: 23, fontWeight: '900', marginTop: -2 },
  disclaimer: { color: theme.textDim, fontSize: 9, textAlign: 'center', marginTop: 7 },
  loading: { position: 'absolute', alignSelf: 'center', bottom: 104, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#15151a', borderWidth: 1, borderColor: theme.line, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 99 },
  loadingText: { color: theme.textMuted, fontSize: 11 },
  pressed: { opacity: 0.65, transform: [{ scale: 0.97 }] },
});
