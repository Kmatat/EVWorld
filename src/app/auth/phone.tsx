import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { toast } from '@/components/Toast';
import { Banner, Button, Card, Field, Screen, text } from '@/components/ui';
import { formatEgyptMobile, isValidEgyptMobile } from '@/core/identity';
import { OtpRequest, sendOtp, verifyOtp } from '@/services/auth';
import { useAuthStore } from '@/store/useAuthStore';
import { colors, space } from '@/theme';

export default function PhoneScreen() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const user = useAuthStore((s) => s.user);
  const completeProfile = useAuthStore((s) => s.completeProfile);
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [request, setRequest] = useState<OtpRequest>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <Screen>
        <Banner tone="amber" text="Please sign in first." />
        <Button title="Sign in" onPress={() => router.replace('/auth/sign-in')} />
      </Screen>
    );
  }

  const send = async () => {
    setError(undefined);
    setBusy(true);
    try {
      setRequest(await sendOtp(phone));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!request) return;
    setBusy(true);
    const ok = await verifyOtp(request.phone, otp);
    setBusy(false);
    if (!ok) {
      setError('That code is not right. Check the SMS and try again.');
      return;
    }
    completeProfile({ name: name.trim(), phone: request.phone });
    toast('Mobile number verified');
    if (returnTo) router.replace(returnTo as never);
    else router.replace('/car');
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Complete your profile' }} />
      <Card>
        <Text style={text.h3}>Your details</Text>
        <Text style={[text.small, { marginTop: 2, marginBottom: space.md }]}>Signed in with {user.provider === 'apple' ? 'Apple' : 'Google'}{user.email ? ` · ${user.email}` : ''}</Text>
        <Field label="Full name" value={name} onChangeText={setName} placeholder="As on your ID" autoComplete="name" />
        <Text style={[text.small, { marginTop: -6, marginBottom: space.md }]}>Other users only see your first name and initial.</Text>
        <Field
          label="Mobile number (required)"
          value={phone}
          onChangeText={(t) => {
            setPhone(t);
            setRequest(undefined);
          }}
          placeholder="010 1234 5678"
          keyboardType="phone-pad"
          autoComplete="tel"
          editable={!request}
        />
        {!request ? (
          <Button title="Send verification code" icon="chatbox-ellipses-outline" disabled={!name.trim() || !isValidEgyptMobile(phone) || busy} onPress={send} />
        ) : (
          <View>
            <Text style={[text.body, { marginBottom: space.sm }]}>
              We sent a 6-digit code to <Text style={text.strong}>{formatEgyptMobile(request.phone)}</Text>.
            </Text>
            {request.demoCode ? <Banner tone="purple" icon="key-outline" text={`Demo build: use code ${request.demoCode}`} /> : null}
            <View style={{ height: space.md }} />
            <Field label="Verification code" value={otp} onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="••••••" autoComplete="one-time-code" />
            <Button title="Verify and continue" disabled={otp.length !== 6 || busy} onPress={verify} />
            <Button title="Change number" kind="ghost" style={{ marginTop: space.sm }} onPress={() => setRequest(undefined)} />
          </View>
        )}
        {error ? <Text style={{ color: colors.red, marginTop: space.sm }}>{error}</Text> : null}
      </Card>
      <Banner
        icon="shield-checkmark-outline"
        tone="green"
        text="Why we need it: couriers and sellers need a reachable number for deliveries, and one verified number per account keeps fake accounts and reviews out. Your number is never shown in chats or listings."
      />
    </Screen>
  );
}
