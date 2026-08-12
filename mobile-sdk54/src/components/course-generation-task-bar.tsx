import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { palette, radius, spacing, typography } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { useFluidLayout } from '@/lib/use-fluid-layout';
import { useCourseGeneration } from '@/providers/course-generation-provider';
import { useLocale } from '@/providers/locale-provider';
import { useOverlayInset } from '@/providers/overlay-inset-provider';

export function CourseGenerationTaskBar() {
  const { clear, state, retry } = useCourseGeneration();
  const { t } = useLocale();
  const router = useRouter();
  const segments = useSegments();
  const route = segments.join('/');
  const inTabs = route.includes('(tabs)');
  const inCreateCourse = route.includes('create-course');
  const insets = useSafeAreaInsets();
  const fluid = useFluidLayout();
  const { setOverlayInset } = useOverlayInset();
  const largeText = fluid.largeText;
  const visible = state.status !== 'idle' && !(inCreateCourse && state.status === 'ready');

  useEffect(() => {
    if (!visible) setOverlayInset(0);
    return () => setOverlayInset(0);
  }, [setOverlayInset, visible]);

  if (!visible) return null;

  const running = state.status === 'running';
  const ready = state.status === 'ready';
  const expired = state.status === 'error' && state.error === 'expired';
  const title = t(
    running
      ? 'generation.running.title'
      : ready
        ? 'generation.ready.title'
        : expired
          ? 'generation.expired.title'
          : 'generation.error.title',
  );
  const body = t(
    running
      ? 'generation.running.body'
      : ready
        ? 'generation.ready.body'
        : expired
          ? 'generation.expired.body'
          : 'generation.error.body',
  );

  const activate = () => {
    if (running) return;
    haptics.light();
    if (ready) {
      router.push('/create-course');
      return;
    }
    if (expired) {
      clear();
      router.push('/create-course');
      return;
    }
    retry();
  };

  return (
    <View
      onLayout={({ nativeEvent }) => setOverlayInset(nativeEvent.layout.height + spacing.md)}
      pointerEvents="box-none"
      style={[
        styles.dock,
        {
          left: fluid.gutter,
          right: fluid.gutter,
          bottom: (inTabs ? fluid.tabBarHeight : insets.bottom) + fluid.gutter * 0.6,
        },
      ]}>
      <Pressable
        accessibilityLabel={`${title}. ${body}`}
        accessibilityLiveRegion="polite"
        accessibilityRole={running ? 'progressbar' : 'button'}
        accessibilityState={{ busy: running }}
        disabled={running}
        onPress={activate}
        style={({ pressed }) => [
          styles.task,
          { minHeight: fluid.controlSize, paddingHorizontal: fluid.gutter * 0.7, paddingVertical: fluid.gutter * 0.45 },
          largeText && styles.taskLargeText,
          state.status === 'error' && styles.taskError,
          pressed && styles.pressed,
        ]}>
        <View
          style={[
            styles.icon,
            { width: fluid.controlSize * 0.85, aspectRatio: 1 },
            ready && styles.iconReady,
            state.status === 'error' && styles.iconError,
          ]}>
          {running ? (
            <ActivityIndicator color={palette.primary} size="small" />
          ) : (
            <AppIcon
              color={ready ? palette.onPrimary : palette.danger}
              name={ready ? 'check' : 'refresh'}
              size={19}
            />
          )}
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
        {!running ? <AppIcon color={palette.muted} name="chevron-right" size={20} /> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 100,
  },
  task: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,

    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.primary,
    backgroundColor: palette.surface,
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 10,
  },
  taskError: { borderColor: palette.danger },
  taskLargeText: { flexDirection: 'column', alignItems: 'stretch', paddingVertical: spacing.md },
  icon: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primarySoft,
  },
  iconReady: { backgroundColor: palette.success },
  iconError: { backgroundColor: palette.dangerSoft },
  copy: { flex: 1, gap: 2 },
  title: { color: palette.ink, fontFamily: typography.strong, fontSize: 14 },
  body: { color: palette.muted, fontFamily: typography.body, fontSize: 12 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
});
