import { router } from 'expo-router';

import { useAuthStore } from '@/store/useAuthStore';

/**
 * Browsing never needs an account (Apple's App Store rules discourage
 * forcing sign-up just to look around). Actions that involve another person
 * or money (checkout, chat, booking, hosting) need a signed-in account with
 * a verified mobile.
 */
export function useRequireAccount() {
  const user = useAuthStore((s) => s.user);
  const ready = !!user?.phoneVerified;
  const requireAccount = (returnTo: string): boolean => {
    if (ready) return true;
    if (user) router.push({ pathname: '/auth/phone', params: { returnTo } });
    else router.push({ pathname: '/auth/sign-in', params: { returnTo } });
    return false;
  };
  return { user, ready, requireAccount };
}
