import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { palette, spacing, typography } from '@/constants/theme';

import { ScioMark } from './scio-mark';

export function BrandLoader({ caption }: { caption?: string }) {
  const reducedMotion = useReducedMotion();
  const breath = useSharedValue(1);
  const halo = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      breath.value = 1;
      halo.value = 0;
      return;
    }
    breath.value = withRepeat(
      withSequence(
        withTiming(1.07, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    halo.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    );
  }, [breath, halo, reducedMotion]);

  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - halo.value),
    transform: [{ scale: 1 + halo.value * 0.55 }],
  }));

  return (
    <View accessibilityLabel={caption ?? 'SCIO'} accessibilityRole="progressbar" style={styles.container}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.logoWrap}>
        <Animated.View style={[styles.halo, haloStyle]} />
        <Animated.View style={[styles.logoTile, logoStyle]}>
          <ScioMark size={54} />
        </Animated.View>
      </View>
      <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.wordmark}>SCIO</Text>
      {caption ? <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  logoWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  halo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: palette.primary,
  },
  logoTile: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 8,
  },
  wordmark: {
    color: palette.ink,
    fontFamily: typography.display,
    fontSize: 20,
    letterSpacing: 8,
    marginLeft: 8,
  },
  caption: {
    color: palette.muted,
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
