import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { clearSession, getMe, type User } from '../lib/auth';
import { theme, shadow } from '../lib/theme';

export default function Settings() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [haptics, setHaptics] = useState(true);

  useEffect(() => {
    getMe().then((value) => { if (!value) router.replace('/login'); else setUser(value); });
  }, [router]);

  async function logout() {
    await clearSession();
    router.replace('/login');
  }

  function confirmLogout() {
    Alert.alert('تسجيل الخروج', 'هل تريد تسجيل الخروج من STAR AI؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'تسجيل الخروج', style: 'destructive', onPress: logout },
    ]);
  }

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.duration(350)} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.icon}><Text style={styles.back}>‹</Text></Pressable>
        <View><Text style={styles.kicker}>STAR AI</Text><Text style={styles.title}>الإعدادات</Text></View>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(80).duration(350)} style={styles.profile}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(user?.name || 'S').slice(0, 1).toUpperCase()}</Text></View>
        <View style={styles.profileInfo}><Text style={styles.name}>{user?.name || 'STAR AI User'}</Text><Text style={styles.email}>{user?.email || ''}</Text></View>
        <View style={styles.creditBadge}><Text style={styles.creditValue}>{user?.credits ?? 0}</Text><Text style={styles.creditLabel}>Credits</Text></View>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(150).duration(350)} style={styles.card}>
        <Text style={styles.section}>التطبيق</Text>
        <View style={styles.row}><View><Text style={styles.rowTitle}>الحركة اللمسية</Text><Text style={styles.rowSub}>تحسين الإحساس بالتفاعل داخل التطبيق</Text></View><Switch value={haptics} onValueChange={setHaptics} trackColor={{ false: theme.line, true: '#777' }} thumbColor={theme.white} /></View>
        <Pressable style={styles.rowButton} onPress={() => router.push('/chat')}><Text style={styles.rowTitle}>المحادثة</Text><Text style={styles.arrow}>‹</Text></Pressable>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(220).duration(350)} style={styles.card}>
        <Text style={styles.section}>الحساب</Text>
        <Pressable style={styles.rowButton} onPress={() => Alert.alert('Credits', `رصيدك الحالي: ${user?.credits ?? 0}`)}><Text style={styles.rowTitle}>الرصيد</Text><Text style={styles.rowValue}>{user?.credits ?? 0}</Text></Pressable>
        <Pressable style={[styles.rowButton, styles.danger]} onPress={confirmLogout}><Text style={styles.dangerText}>تسجيل الخروج</Text><Text style={styles.arrow}>‹</Text></Pressable>
      </Animated.View>

      <Text style={styles.version}>STAR AI Mobile · 0.1.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 16, paddingTop: 56 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  icon: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' },
  back: { color: theme.text, fontSize: 34, marginTop: -3 },
  kicker: { color: theme.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  title: { color: theme.text, fontSize: 27, fontWeight: '800', marginTop: 2 },
  profile: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 22, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface, ...shadow },
  avatar: { width: 48, height: 48, borderRadius: 17, backgroundColor: theme.white, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: theme.black, fontSize: 19, fontWeight: '900' },
  profileInfo: { flex: 1, marginLeft: 12 },
  name: { color: theme.text, fontSize: 15, fontWeight: '800' },
  email: { color: theme.textDim, fontSize: 11, marginTop: 4 },
  creditBadge: { alignItems: 'flex-end' },
  creditValue: { color: theme.text, fontSize: 18, fontWeight: '900' },
  creditLabel: { color: theme.textDim, fontSize: 9, marginTop: 2 },
  card: { marginTop: 14, padding: 15, borderRadius: 22, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface },
  section: { color: theme.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 7 },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowButton: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.line },
  rowTitle: { color: theme.text, fontSize: 13, fontWeight: '700' },
  rowSub: { color: theme.textDim, fontSize: 10, marginTop: 4 },
  rowValue: { color: theme.textMuted, fontSize: 13, fontWeight: '800' },
  arrow: { color: theme.textDim, fontSize: 25, transform: [{ rotate: '180deg' }] },
  danger: { marginTop: 1 },
  dangerText: { color: '#ff9da9', fontSize: 13, fontWeight: '800' },
  version: { textAlign: 'center', color: theme.textDim, fontSize: 10, marginTop: 18 },
});
