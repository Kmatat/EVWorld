import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Banner, Card, IconName, Row, Screen, text } from '@/components/ui';
import { signInWithApple, signInWithGoogle, SocialProfile } from '@/services/auth';
import { useAuthStore } from '@/store/useAuthStore';
import { colors, radius, space } from '@/theme';

const BENEFITS: [IconName, string][] = [
  ['bag-check-outline', 'Order accessories and book workshops'],
  ['chatbubbles-outline', 'Chat with sellers and charger hosts, with your number kept private'],
  ['home-outline', 'Share your own charger and earn per kWh'],
  ['sync-outline', 'Keep your car, trips and orders on every device'],
];

export default function SignInScreen() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const signIn = useAuthStore((s) => s.signIn);
  const existing = useAuthStore((s) => s.user);
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
  const [error, setError] = useState<string>();

  const finish = (p: SocialProfile) => {
    signIn({ id: `${p.provider}:${p.providerUserId}`, provider: p.provider, name: p.name ?? '', email: p.email });
    const user = useAuthStore.getState().user;
    if (user?.phoneVerified) {
      if (returnTo) router.replace(returnTo as never);
      else router.back();
    } else {
      router.replace({ pathname: '/auth/phone', params: returnTo ? { returnTo } : {} });
    }
  };

  const run = async (provider: 'apple' | 'google') => {
    setBusy(provider);
    setError(undefined);
    try {
      finish(provider === 'apple' ? await signInWithApple() : await signInWithGoogle());
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== 'ERR_REQUEST_CANCELED') setError('Sign-in did not complete. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Sign in', presentation: 'modal' }} />
      <View style={{ alignItems: 'center', paddingVertical: space.lg }}>
        <View style={styles.logo}>
          <Ionicons name="flash" size={34} color="#fff" />
        </View>
        <Text style={[text.h1, { marginTop: space.md }]}>Welcome to EVWorld</Text>
        <Text style={[text.body, { textAlign: 'center', marginTop: 4 }]}>Browse freely. Sign in when you want to order, chat, book or share your charger.</Text>
      </View>

      <Pressable style={[styles.socialBtn, { backgroundColor: '#000' }]} onPress={() => run('apple')} disabled={!!busy} accessibilityRole="button">
        {busy === 'apple' ? <ActivityIndicator color="#fff" /> : <Ionicons name="logo-apple" size={20} color="#fff" />}
        <Text style={[styles.socialText, { color: '#fff' }]}>Continue with Apple</Text>
      </Pressable>
      <Pressable style={[styles.socialBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]} onPress={() => run('google')} disabled={!!busy} accessibilityRole="button">
        {busy === 'google' ? <ActivityIndicator color={colors.ink} /> : <Ionicons name="logo-google" size={19} color="#EA4335" />}
        <Text style={[styles.socialText, { color: colors.ink }]}>Continue with Google</Text>
      </Pressable>
      {error ? <Banner tone="red" text={error} icon="alert-circle-outline" /> : null}

      <Card>
        {BENEFITS.map(([icon, line]) => (
          <Row key={line} style={{ paddingVertical: 6 }}>
            <Ionicons name={icon} size={18} color={colors.primary} />
            <Text style={[text.body, { flex: 1 }]}>{line}</Text>
          </Row>
        ))}
      </Card>
      <Banner
        icon="phone-portrait-outline"
        text="Next we'll verify your mobile number. It is required for deliveries and safety, and it is never shown to other users."
      />
      {existing && !existing.phoneVerified ? (
        <Pressable onPress={() => router.replace({ pathname: '/auth/phone', params: returnTo ? { returnTo } : {} })}>
          <Text style={[text.small, { textAlign: 'center', color: colors.primaryDark }]}>Continue verifying {existing.email ?? 'your account'}</Text>
        </Pressable>
      ) : null}
      <Text style={[text.small, { textAlign: 'center' }]}>By continuing you agree to the Terms of Use and Privacy Policy. Demo build: Google sign-in is simulated.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: { width: 64, height: 64, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  socialBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, borderRadius: radius.md },
  socialText: { fontSize: 16, fontWeight: '700' },
});
