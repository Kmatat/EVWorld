import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

import { normalizeEgyptMobile } from '@/core/identity';

/**
 * SIGN-IN
 * =======
 * Social login (Apple, Google) creates the account in one tap. A verified
 * Egyptian mobile number is then required before the account can order,
 * chat, book or host a charger.
 *
 * Apple's App Store rule: an app that offers Google sign-in must also offer
 * Sign in with Apple. We offer both.
 *
 * Production: the app sends the Apple / Google identity token to the
 * backend (e.g. Supabase Auth), which verifies it and returns a session.
 * The phone OTP is sent by SMS (or WhatsApp) by the backend. In this
 * prototype:
 *  - Apple sign-in is real on iPhones (the user's name/email come back from
 *    Apple), and simulated elsewhere;
 *  - Google sign-in is simulated until OAuth client IDs are configured;
 *  - the OTP code is shown on screen (123456).
 */

export type AuthProvider = 'apple' | 'google';

export interface SocialProfile {
  provider: AuthProvider;
  providerUserId: string;
  name?: string;
  email?: string;
  /** True when the sign-in really went through the provider (not demo mode). */
  verifiedByProvider: boolean;
}

export const DEMO_OTP = '123456';

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function signInWithApple(): Promise<SocialProfile> {
  if (await isAppleSignInAvailable()) {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    const name = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(' ') || undefined;
    // Production: send cred.identityToken to the backend for verification.
    return { provider: 'apple', providerUserId: cred.user, name, email: cred.email ?? undefined, verifiedByProvider: true };
  }
  return { provider: 'apple', providerUserId: `apple-demo-${Date.now()}`, name: 'Demo Driver', email: 'demo.driver@privaterelay.example', verifiedByProvider: false };
}

export async function signInWithGoogle(): Promise<SocialProfile> {
  // Production: Google Sign-In with the app's OAuth client IDs (iOS, Android, web),
  // then the ID token goes to the backend. Simulated in the prototype.
  return { provider: 'google', providerUserId: `google-demo-${Date.now()}`, name: 'Demo Driver', email: 'demo.driver@gmail.example', verifiedByProvider: false };
}

export interface OtpRequest {
  phone: string;
  /** Shown only in demo mode. */
  demoCode?: string;
}

export async function sendOtp(rawPhone: string): Promise<OtpRequest> {
  const phone = normalizeEgyptMobile(rawPhone);
  if (!phone) throw new Error('Enter a valid Egyptian mobile number, e.g. 010 1234 5678.');
  await new Promise((r) => setTimeout(r, 400));
  return { phone, demoCode: DEMO_OTP };
}

export async function verifyOtp(_phone: string, code: string): Promise<boolean> {
  await new Promise((r) => setTimeout(r, 300));
  return code.trim() === DEMO_OTP;
}
