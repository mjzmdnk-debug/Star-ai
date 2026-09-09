import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getMe, type User } from '../lib/auth';

export default function Index() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe().then((current) => {
      setUser(current);
      setLoading(false);
    });
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#fff" /></View>;

  if (!user) {
    return (
      <View style={styles.container}>
        <View>
          <Text style={styles.logo}>STAR AI</Text>
          <Text style={styles.title}>Your AI, everywhere.</Text>
          <Text style={styles.subtitle}>Chat, research and create with STAR AI.</Text>
        </View>
        <View style={styles.actions}>
          <Pressable style={styles.primary} onPress={() => router.push('/login')}><Text style={styles.primaryText}>تسجيل الدخول</Text></Pressable>
          <Pressable style={styles.secondary} onPress={() => router.push('/register')}><Text style={styles.secondaryText}>إنشاء حساب</Text></Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>STAR AI</Text>
      <Text style={styles.title}>مرحبًا {user.name}</Text>
      <Text style={styles.subtitle}>الرصيد: {user.credits ?? 0} Credits</Text>
      <Pressable style={styles.primary} onPress={() => router.push('/chat')}><Text style={styles.primaryText}>ابدأ المحادثة</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 28, justifyContent: 'space-between', backgroundColor: '#07070a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#07070a' },
  logo: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 3, marginTop: 30 },
  title: { color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 70 },
  subtitle: { color: '#9b9ba5', fontSize: 16, lineHeight: 24, marginTop: 14 },
  actions: { gap: 12, marginBottom: 20 },
  primary: { backgroundColor: '#fff', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  primaryText: { color: '#08080a', fontSize: 16, fontWeight: '700' },
  secondary: { borderWidth: 1, borderColor: '#303039', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  secondaryText: { color: '#fff', fontSize: 16, fontWeight: '700' }
});
