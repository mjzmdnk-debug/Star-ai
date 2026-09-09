import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { login } from '../lib/auth';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email || !password) return Alert.alert('STAR AI', 'أدخل البريد الإلكتروني وكلمة المرور.');
    setBusy(true);
    try { await login(email, password); router.replace('/'); }
    catch (error) { Alert.alert('تعذر تسجيل الدخول', error instanceof Error ? error.message : 'حدث خطأ غير متوقع.'); }
    finally { setBusy(false); }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.logo}>STAR AI</Text>
      <Text style={styles.title}>تسجيل الدخول</Text>
      <TextInput style={styles.input} placeholder="البريد الإلكتروني" placeholderTextColor="#6d6d76" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="كلمة المرور" placeholderTextColor="#6d6d76" value={password} onChangeText={setPassword} secureTextEntry />
      <Pressable style={styles.primary} disabled={busy} onPress={submit}><Text style={styles.primaryText}>{busy ? 'جارٍ الدخول...' : 'دخول'}</Text></Pressable>
      <Pressable onPress={() => router.push('/register')}><Text style={styles.link}>ليس لديك حساب؟ إنشاء حساب</Text></Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07070a', padding: 28, justifyContent: 'center', gap: 14 },
  logo: { color: '#fff', fontWeight: '800', letterSpacing: 3, marginBottom: 25 },
  title: { color: '#fff', fontSize: 30, fontWeight: '800', marginBottom: 15 },
  input: { backgroundColor: '#121218', borderWidth: 1, borderColor: '#292930', color: '#fff', borderRadius: 13, padding: 16, fontSize: 16 },
  primary: { backgroundColor: '#fff', padding: 16, borderRadius: 13, alignItems: 'center', marginTop: 8 },
  primaryText: { color: '#08080a', fontWeight: '800', fontSize: 16 },
  link: { color: '#aaaab4', textAlign: 'center', marginTop: 12 }
});
