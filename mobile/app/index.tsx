import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getMe, type User } from '../lib/auth';
import { theme, shadow } from '../lib/theme';

export default function Index() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(18)).current;
  const compact = width < 390;

  useEffect(() => {
    getMe().then((current) => {
      setUser(current);
      setLoading(false);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(rise, { toValue: 0, damping: 18, stiffness: 140, mass: 0.7, useNativeDriver: true }),
      ]).start();
    });
  }, [fade, rise]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={theme.white} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.glowOne} /><View style={styles.glowTwo} />
      <Animated.View style={[styles.content, { opacity: fade, transform: [{ translateY: rise }] }]}>
        <View style={styles.topRow}><View style={styles.brandMark}><Text style={styles.brandMarkText}>S</Text></View><Text style={styles.logo}>STAR AI</Text></View>
        <View style={styles.hero}>
          <View style={styles.badge}><View style={styles.liveDot} /><Text style={styles.badgeText}>AI • READY</Text></View>
          <Text style={[styles.title, compact && styles.titleCompact]}>Your AI,{"\n"}everywhere.</Text>
          <Text style={styles.subtitle}>Chat, research and create with a fast, private and beautifully designed AI experience.</Text>
        </View>
        {!user ? (
          <View style={styles.actions}>
            <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={() => router.push('/login')}><Text style={styles.primaryText}>تسجيل الدخول</Text><Text style={styles.arrow}>→</Text></Pressable>
            <Pressable style={({ pressed }) => [styles.secondary, pressed && styles.pressed]} onPress={() => router.push('/register')}><Text style={styles.secondaryText}>إنشاء حساب</Text></Pressable>
          </View>
        ) : (
          <View style={styles.actions}>
            <View style={styles.accountCard}><View style={styles.avatar}><Text style={styles.avatarText}>{user.name?.slice(0, 1).toUpperCase() || 'S'}</Text></View><View style={styles.accountInfo}><Text style={styles.hello}>مرحبًا، {user.name}</Text><Text style={styles.credits}>الرصيد {user.credits ?? 0} Credits</Text></View></View>
            <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={() => router.push('/chat')}><Text style={styles.primaryText}>ابدأ المحادثة</Text><Text style={styles.arrow}>→</Text></Pressable>
          </View>
        )}
      </Animated.View>
      <Text style={styles.footer}>STAR AI • INTELLIGENCE, REFINED</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 24, paddingTop: 58, paddingBottom: 24, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg },
  content: { flex: 1, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 34, height: 34, borderRadius: 10, backgroundColor: theme.white, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: theme.black, fontSize: 18, fontWeight: '900' },
  logo: { color: theme.text, fontSize: 15, fontWeight: '800', letterSpacing: 3 },
  hero: { marginTop: 50 },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: theme.line, backgroundColor: '#0b0b0f', borderRadius: 99, paddingHorizontal: 11, paddingVertical: 7 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.white },
  badgeText: { color: theme.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: theme.text, fontSize: 52, lineHeight: 55, fontWeight: '800', letterSpacing: -2.1, marginTop: 20 },
  titleCompact: { fontSize: 45, lineHeight: 49 },
  subtitle: { color: theme.textMuted, fontSize: 16, lineHeight: 25, marginTop: 20, maxWidth: 390 },
  actions: { gap: 12, marginBottom: 8 },
  primary: { minHeight: 58, borderRadius: theme.radiusMd, backgroundColor: theme.white, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', ...shadow },
  primaryText: { color: theme.black, fontSize: 16, fontWeight: '800' },
  arrow: { position: 'absolute', right: 18, color: theme.black, fontSize: 22, fontWeight: '700' },
  secondary: { minHeight: 56, borderWidth: 1, borderColor: theme.line, backgroundColor: '#0b0b0f', borderRadius: theme.radiusMd, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: theme.text, fontSize: 16, fontWeight: '700' },
  accountCard: { minHeight: 76, padding: 12, borderRadius: theme.radiusLg, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 50, height: 50, borderRadius: 16, backgroundColor: theme.white, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: theme.black, fontSize: 18, fontWeight: '900' },
  accountInfo: { flex: 1 },
  hello: { color: theme.text, fontSize: 16, fontWeight: '800' },
  credits: { color: theme.textMuted, fontSize: 12, marginTop: 5 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  footer: { color: theme.textDim, fontSize: 9, fontWeight: '700', letterSpacing: 1.6, textAlign: 'center', marginTop: 12 },
  glowOne: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: '#111116', opacity: 0.65, top: -150, right: -110 },
  glowTwo: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: '#101015', opacity: 0.55, bottom: -210, left: -150 },
});
