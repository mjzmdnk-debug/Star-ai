import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { register } from '../lib/auth';
import { theme, shadow } from '../lib/theme';

export default function Register() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (name.trim().length < 2 || !email || password.length < 8) return Alert.alert('STAR AI', 'أدخل الاسم والبريد وكلمة مرور من 8 أحرف على الأقل.');
    setBusy(true);
    try { await register(name.trim(), email.trim(), password); router.replace('/'); }
    catch (error) { Alert.alert('تعذر إنشاء الحساب', error instanceof Error ? error.message : 'حدث خطأ غير متوقع.'); }
    finally { setBusy(false); }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.top}><Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View style={styles.brand}><View style={styles.mark}><Text style={styles.markText}>S</Text></View><Text style={styles.logo}>STAR AI</Text></View></View>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>GET STARTED</Text><Text style={styles.title}>إنشاء حساب</Text><Text style={styles.subtitle}>أنشئ حسابك وابدأ تجربة STAR AI.</Text>
        <View style={styles.fields}>
          <TextInput style={styles.input} placeholder="الاسم" placeholderTextColor={theme.textDim} value={name} onChangeText={setName} textAlign="right" />
          <TextInput style={styles.input} placeholder="البريد الإلكتروني" placeholderTextColor={theme.textDim} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" textAlign="right" />
          <TextInput style={styles.input} placeholder="كلمة المرور" placeholderTextColor={theme.textDim} value={password} onChangeText={setPassword} secureTextEntry textAlign="right" />
        </View>
        <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} disabled={busy} onPress={submit}><Text style={styles.primaryText}>{busy ? 'جارٍ إنشاء الحساب...' : 'إنشاء الحساب'}</Text></Pressable>
        <Pressable onPress={() => router.replace('/login')}><Text style={styles.link}>لديك حساب؟ <Text style={styles.linkStrong}>تسجيل الدخول</Text></Text></Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 20, paddingTop: 55 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 42, height: 42, borderRadius: 13, borderWidth: 1, borderColor: theme.line, alignItems: 'center', justifyContent: 'center' },
  backText: { color: theme.text, fontSize: 34, lineHeight: 30 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  mark: { width: 32, height: 32, borderRadius: 9, backgroundColor: theme.white, alignItems: 'center', justifyContent: 'center' },
  markText: { color: theme.black, fontWeight: '900' },
  logo: { color: theme.text, fontWeight: '800', letterSpacing: 2.5 },
  card: { marginTop: 42, borderWidth: 1, borderColor: theme.line, borderRadius: 24, backgroundColor: theme.surface, padding: 20, ...shadow },
  eyebrow: { color: theme.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 1.8 },
  title: { color: theme.text, fontSize: 32, fontWeight: '800', marginTop: 12 },
  subtitle: { color: theme.textMuted, fontSize: 14, marginTop: 8, lineHeight: 21 },
  fields: { gap: 10, marginTop: 26 },
  input: { minHeight: 54, backgroundColor: '#101015', borderWidth: 1, borderColor: theme.line, color: theme.text, borderRadius: 15, paddingHorizontal: 15, fontSize: 16 },
  primary: { minHeight: 56, backgroundColor: theme.white, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 16, ...shadow },
  primaryText: { color: theme.black, fontWeight: '800', fontSize: 16 },
  link: { color: theme.textMuted, textAlign: 'center', marginTop: 18, fontSize: 13 },
  linkStrong: { color: theme.text, fontWeight: '800' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.985 }] },
});
