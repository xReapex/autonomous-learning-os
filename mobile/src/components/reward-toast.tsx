import { AppIcon } from './app-icon';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, radius, spacing, typography } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import type { TranslationKey } from '@/lib/i18n';
import { milestoneDefinitions } from '@/lib/rewards';
import { useFluidLayout } from '@/lib/use-fluid-layout';
import { useLocale } from '@/providers/locale-provider';
import { useRewards } from '@/providers/rewards-provider';

const rewardKeys = {
  lesson_completed: 'reward.lesson',
  exercise_passed: 'reward.exercise',
  review_recalled: 'reward.review',
} as const satisfies Record<string, TranslationKey>;

export function RewardToast() {
  const { t } = useLocale();
  const { notice, clearNotice } = useRewards();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const fluid = useFluidLayout();

  useEffect(() => {
    if (!notice) return;
    haptics.success();
    const timer = setTimeout(clearNotice, 6000);
    return () => clearTimeout(timer);
  }, [clearNotice, notice]);

  if (!notice) return null;
  const milestone = milestoneDefinitions.find(({ id }) => notice.milestoneIds.includes(id));

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          top: insets.top + fluid.gutter * 0.4,
          left: fluid.gutter + (fluid.tablet ? fluid.tabBarWidth : 0),
          right: fluid.gutter,
        },
      ]}>
      <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(350)} exiting={reducedMotion ? undefined : FadeOutUp.duration(250)} style={styles.motion}>
        <Pressable
          accessibilityHint={t('a11y.dismiss')}
          accessibilityLiveRegion="polite"
          accessibilityRole="button"
          accessibilityLabel={`${t(rewardKeys[notice.type], { count: notice.xp })}${
            milestone ? `. ${t('reward.milestone', { name: t(milestone.nameKey) })}` : ''
          }`}
          onPress={clearNotice}
          style={({ pressed }) => [
            styles.toast,
            { minHeight: fluid.controlSize, padding: fluid.gutter * 0.65 },
            pressed && styles.pressed,
          ]}>
          <View style={[styles.icon, { width: fluid.controlSize * 0.75, aspectRatio: 1 }]}>
            <AppIcon name="award" size={fluid.controlSize * 0.38} color={palette.onPrimary} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>{t(rewardKeys[notice.type], { count: notice.xp })}</Text>
            {milestone ? (
              <Text style={styles.body}>
                {t('reward.milestone', { name: t(milestone.nameKey) })}
              </Text>
            ) : null}
          </View>
          <AppIcon name="close" size={18} color={palette.muted} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    zIndex: 100,
    alignItems: 'center',
  },
  motion: { width: '100%' },
  toast: {
    width: '100%',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,

    backgroundColor: palette.surfaceRaised,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 10,
  },
  icon: {
    borderRadius: radius.pill,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 2 },
  title: { color: palette.ink, fontFamily: typography.strong, fontSize: 14 },
  body: { color: palette.primaryText, fontFamily: typography.body, fontSize: 12 },
  pressed: { opacity: 0.85 },
});
