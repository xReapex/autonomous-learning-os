import { useFonts } from 'expo-font';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthScreen } from '@/components/auth-screen';
import { BrandLoader } from '@/components/brand-loader';
import { CourseGenerationTaskBar } from '@/components/course-generation-task-bar';
import { RewardToast } from '@/components/reward-toast';
import { palette } from '@/constants/theme';
import { fontAssets } from '@/lib/fonts';
import { startupDecision } from '@/lib/startup-readiness';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { CourseGenerationProvider } from '@/providers/course-generation-provider';
import { DataProvider } from '@/providers/data-provider';
import { LocaleProvider, useLocale } from '@/providers/locale-provider';
import { OverlayInsetProvider } from '@/providers/overlay-inset-provider';
import { RewardsProvider, useRewards } from '@/providers/rewards-provider';

void SplashScreen.preventAutoHideAsync();

function Loading() {
  return (
    <View style={styles.loading}>
      <BrandLoader />
    </View>
  );
}

function Bootstrap() {
  const { ready: rewardsReady } = useRewards();

  if (!rewardsReady) return <Loading />;

  return (
    <DataProvider>
      <OverlayInsetProvider>
        <CourseGenerationProvider>
          <StatusBar style="dark" />
          <Slot />
          <CourseGenerationTaskBar />
          <RewardToast />
        </CourseGenerationProvider>
      </OverlayInsetProvider>
    </DataProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LocaleProvider>
        <AuthProvider>
          <AuthBoundary />
        </AuthProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}

function AuthBoundary() {
  const { status, user } = useAuth();
  const { ready: localeReady } = useLocale();
  const [fontsReady, fontError] = useFonts(fontAssets);
  const [timedOut, setTimedOut] = useState(false);
  const decision = startupDecision({
    localeReady,
    fontsReady,
    fontError: Boolean(fontError),
    authChecking: status === 'checking',
    timedOut,
  });
  const ready = decision !== 'wait';

  useEffect(() => {
    const deadline = setTimeout(() => setTimedOut(true), 10_000);
    return () => clearTimeout(deadline);
  }, []);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return <Loading />;
  if (decision === 'fallback' || status !== 'signed-in') {
    return (
      <>
        <StatusBar style="dark" />
        <AuthScreen />
      </>
    );
  }

  if (!user) return <Loading />;
  return <AuthenticatedProviders userId={user.id} />;
}

function AuthenticatedProviders({ userId }: { userId: string }) {
  return (
    <RewardsProvider key={`rewards-${userId}`}>
      <Bootstrap key={`session-${userId}`} />
    </RewardsProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: palette.canvas, alignItems: 'center', justifyContent: 'center' },
});
