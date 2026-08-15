import { type Href, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { elevation, layout, palette, radius, spacing, typography } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { resolveIndeterminateOffset } from '@/lib/progress-animation';
import { useFluidLayout } from '@/lib/use-fluid-layout';
import { useLocale } from '@/providers/locale-provider';
import { useScioData } from '@/providers/data-provider';
import { useOverlayInset } from '@/providers/overlay-inset-provider';

import { AppIcon, type AppIconName } from './app-icon';
import { BrandLoader } from './brand-loader';
import { ScioMark } from './scio-mark';

type IconName = AppIconName;

export function AppScreen({ children, contentContainerStyle }: {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const { overlayInset } = useOverlayInset();
  const fluid = useFluidLayout();
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.screenContent,
          {
            width: fluid.contentWidth,
            paddingHorizontal: fluid.gutter,
            paddingTop: fluid.gutter,
            paddingBottom: fluid.sectionGap + overlayInset,
            gap: fluid.sectionGap,
          },
          contentContainerStyle,
        ]}
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Reveal({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(delay).duration(450)} style={style}>
      {children}
    </Animated.View>
  );
}

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  const fluid = useFluidLayout();
  return (
    <View style={styles.header}>
      <View style={styles.headerTopline}>
        <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.headerWordmark}>
          SCIO
        </Text>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
      </View>
      <Text
        accessibilityRole="header"
        style={[styles.title, { fontSize: fluid.titleSize, lineHeight: fluid.titleLineHeight }]}>
        {title}
      </Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  const fluid = useFluidLayout();
  const size = fluid.controlSize * (compact ? 0.72 : 1);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.brandMark, { width: size, aspectRatio: 1 }]}>
      <ScioMark size={size} />
    </View>
  );
}

export function SectionTitle({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {children}
      </Text>
      {trailing}
    </View>
  );
}

export function Surface({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const fluid = useFluidLayout();
  return <View style={[styles.surface, { padding: fluid.cardPadding }, style]}>{children}</View>;
}

export function StateScene({
  actionIcon,
  actionLabel,
  alert = false,
  body,
  icon,
  live = false,
  onAction,
  style,
  title,
  tone = 'neutral',
}: {
  actionIcon?: IconName;
  actionLabel?: string;
  alert?: boolean;
  body: string;
  icon: IconName;
  live?: boolean;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
  title: string;
  tone?: 'danger' | 'editorial' | 'neutral' | 'success';
}) {
  const fluid = useFluidLayout();
  const condensed = fluid.largeText && fluid.shortViewport;
  const danger = tone === 'danger';
  const editorial = tone === 'editorial';
  const success = tone === 'success';
  return (
    <Surface
      style={[
        styles.stateScene,
        condensed && styles.stateSceneCondensed,
        editorial && styles.stateSceneEditorial,
        style,
      ]}>
      {!condensed ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.stateSceneIcon,
            { width: fluid.controlSize * 1.2, aspectRatio: 1 },
            editorial && styles.stateSceneIconEditorial,
            danger && styles.stateSceneIconDanger,
            success && styles.stateSceneIconSuccess,
          ]}>
          <AppIcon
            name={icon}
            size={fluid.controlSize * 0.56}
            color={success ? palette.onPrimary : danger ? palette.danger : palette.primaryText}
          />
        </View>
      ) : null}
      <View
        accessibilityLiveRegion={alert ? 'assertive' : live ? 'polite' : undefined}
        accessibilityRole={alert ? 'alert' : undefined}
        style={styles.stateSceneCopy}>
        <Text
          accessibilityRole="header"
          style={[styles.stateSceneTitle, editorial && styles.stateSceneTitleEditorial]}>
          {title}
        </Text>
        <Text style={[styles.stateSceneBody, editorial && styles.stateSceneBodyEditorial]}>
          {body}
        </Text>
      </View>
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          icon={actionIcon}
          onPress={onAction}
          style={styles.stateSceneAction}
          variant={editorial ? 'contrast' : 'primary'}
        />
      ) : null}
    </Surface>
  );
}

export function BentoGrid({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.bentoGrid, style]}>{children}</View>;
}

export function BentoTile({
  children,
  span = 'half',
  style,
}: {
  children: ReactNode;
  span?: 'half' | 'wide';
  style?: StyleProp<ViewStyle>;
}) {
  const fluid = useFluidLayout();
  return (
    <View
      style={[
        styles.surface,
        styles.bentoTile,
        { padding: fluid.cardPadding },
        span === 'wide' && styles.bentoTileWide,
        style,
      ]}>
      {children}
    </View>
  );
}

type ButtonProps = PressableProps & {
  busy?: boolean;
  label: string;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'ghost' | 'contrast' | 'danger';
};

export function Button({ busy = false, label, icon, variant = 'primary', disabled, onPress, style, ...props }: ButtonProps) {
  const fluid = useFluidLayout();
  const inactive = disabled || busy;
  const labelColor =
    variant === 'primary'
      ? palette.onPrimary
      : variant === 'danger'
        ? palette.white
      : variant === 'contrast'
        ? palette.primaryDark
        : variant === 'secondary'
          ? palette.primaryText
          : palette.ink;
  const accessory = busy
    ? <ActivityIndicator color={labelColor} size="small" />
    : icon
      ? <AppIcon name={icon} size={20} color={labelColor} />
      : null;

  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? label}
      accessibilityState={{ ...props.accessibilityState, busy, disabled: inactive }}
      disabled={inactive}
      onPress={(event) => {
        haptics.light();
        onPress?.(event);
      }}
      style={(state) => [
        styles.button,
        {
          minHeight: fluid.controlSize,
          paddingHorizontal: fluid.gutter * 0.8,
          paddingVertical: fluid.gutter * 0.55,
        },
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'contrast' && styles.buttonContrast,
        variant === 'danger' && styles.buttonDanger,
        variant === 'primary' && styles.buttonPrimary,
        state.pressed && styles.pressed,
        inactive && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}>
      {accessory ? (
        <>
          <View style={styles.buttonAccessory}>{accessory}</View>
          <Text style={[styles.buttonLabel, { color: labelColor }]}>{label}</Text>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.buttonAccessory}
          />
        </>
      ) : (
        <Text style={[styles.buttonLabel, { color: labelColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function ProgressBar({
  value,
  accessibilityLabel,
  trackColor = palette.surfaceRaised,
  fillColor = palette.primary,
  hiddenFromAccessibility = false,
  indeterminate = false,
}: {
  value: number;
  accessibilityLabel: string;
  trackColor?: string;
  fillColor?: string;
  hiddenFromAccessibility?: boolean;
  indeterminate?: boolean;
}) {
  const normalized = Math.max(0, Math.min(100, value));
  const reducedMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const travel = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(travel);
    travel.value = 0;
    if (!indeterminate || reducedMotion || trackWidth <= 0) return;
    travel.value = withRepeat(
      withTiming(1, { duration: 1250, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(travel);
  }, [indeterminate, reducedMotion, trackWidth, travel]);

  const indeterminateStyle = useAnimatedStyle(() => ({
    transform: [{
      translateX: indeterminate
        ? resolveIndeterminateOffset(trackWidth, travel.value, reducedMotion)
        : 0,
    }],
  }));

  return (
    <View
      accessible={!hiddenFromAccessibility}
      accessibilityElementsHidden={hiddenFromAccessibility}
      accessibilityRole={hiddenFromAccessibility ? undefined : 'progressbar'}
      accessibilityLabel={hiddenFromAccessibility ? undefined : accessibilityLabel}
      accessibilityValue={hiddenFromAccessibility ? undefined : { min: 0, max: 100, now: normalized }}
      importantForAccessibility={hiddenFromAccessibility ? 'no-hide-descendants' : 'auto'}
      onLayout={({ nativeEvent }) => setTrackWidth(nativeEvent.layout.width)}
      style={[styles.progressTrack, { backgroundColor: trackColor }]}>
      <Animated.View style={[
        styles.progressFill,
        indeterminateStyle,
        { backgroundColor: fillColor, width: indeterminate ? '34%' : `${normalized}%` },
      ]} />
    </View>
  );
}

export function Metric({
  icon,
  value,
  label,
}: {
  icon: IconName;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.metric} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.metricIcon}>
        <AppIcon name={icon} size={17} color={palette.primaryText} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function StatusBanner() {
  const { t } = useLocale();
  const { errorKey, retry, status } = useScioData();
  if (status !== 'offline' && status !== 'error') return null;
  const offline = status === 'offline';

  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, offline ? styles.bannerOffline : styles.bannerError]}>
      <AppIcon
        name={offline ? 'cloud-off' : 'cloud-alert'}
        size={20}
        color={offline ? palette.amber : palette.danger}
      />
      <View style={styles.bannerCopy}>
        <Text style={styles.bannerTitle}>
          {t(offline ? 'status.offline.title' : 'status.error.title')}
        </Text>
        <Text style={styles.bannerBody}>
          {t(offline ? 'status.offline.body' : errorKey ?? 'status.error.body')}
        </Text>
      </View>
      <Pressable
        accessibilityLabel={t('common.retry')}
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => void retry()}
        style={({ pressed }) => [styles.bannerRetry, pressed && styles.pressed]}>
        <AppIcon name="refresh" size={18} color={offline ? palette.amber : palette.danger} />
      </Pressable>
    </View>
  );
}

export function DataGate({
  children,
}: {
  children: (data: NonNullable<ReturnType<typeof useScioData>['data']>) => ReactNode;
}) {
  const { t } = useLocale();
  const { data, status, errorKey, retry } = useScioData();
  const fluid = useFluidLayout();
  const router = useRouter();

  if (status === 'loading' && !data) {
    return (
      <AppScreen contentContainerStyle={styles.stateScreen}>
        <View style={styles.stateContainer}>
          <BrandLoader caption={t('common.loading')} />
        </View>
      </AppScreen>
    );
  }

  if (status === 'empty') {
    return (
      <AppScreen contentContainerStyle={styles.stateScreen}>
        <View
          style={[
            styles.stateContainer,
            fluid.largeText && fluid.shortViewport && styles.stateContainerShort,
          ]}>
          <StateScene
            actionIcon="arrow-right"
            actionLabel={t('curriculum.create')}
            body={t('curriculum.emptyBody')}
            icon="route"
            onAction={() => router.push('/create-course' as Href)}
            title={t('curriculum.emptyTitle')}
            tone="editorial"
          />
        </View>
      </AppScreen>
    );
  }

  if (!data) {
    return (
      <AppScreen contentContainerStyle={styles.stateScreen}>
        <View style={styles.stateContainer}>
          <StateScene
            actionIcon="refresh"
            actionLabel={t('common.retry')}
            alert
            body={t(errorKey ?? 'status.error.body')}
            icon="cloud-alert"
            onAction={() => void retry()}
            title={t('status.error.title')}
            tone="danger"
          />
        </View>
      </AppScreen>
    );
  }

  return <>{children(data)}</>;
}

export const textStyles = StyleSheet.create({
  body: { color: palette.ink, fontFamily: typography.body, fontSize: 16, lineHeight: 24 },
  muted: { color: palette.muted, fontFamily: typography.body, fontSize: 14, lineHeight: 20 },
  cardTitle: {
    color: palette.ink,
    fontFamily: typography.title,
    fontSize: 19,
    lineHeight: 25,
  },
  label: {
    color: palette.muted,
    fontFamily: typography.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.canvas },
  scroll: { flex: 1, backgroundColor: palette.canvas },
  screenContent: {
    width: '100%',
    alignSelf: 'center',
  },
  header: { paddingTop: spacing.xs, gap: spacing.sm },
  headerTopline: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerWordmark: {
    color: palette.ink,
    fontFamily: typography.brand,
    fontSize: 16,
    letterSpacing: 3.4,
  },
  eyebrow: {
    color: palette.primaryText,
    fontFamily: typography.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: palette.ink,
    fontFamily: typography.display,
    letterSpacing: -1.15,
  },
  subtitle: {
    color: palette.muted,
    fontFamily: typography.body,
    fontSize: 16,
    lineHeight: 24,
  },
  brandMark: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: {
    color: palette.ink,
    fontFamily: typography.title,
    fontSize: 21,
    lineHeight: 27,
  },
  surface: {
    backgroundColor: palette.paper,
    borderColor: palette.surfaceDeep,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  bentoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  bentoTile: { flexGrow: 1, flexBasis: '46%', minWidth: 128 },
  bentoTileWide: { flexBasis: '100%' },
  button: {
    borderRadius: radius.sm,
    backgroundColor: palette.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  buttonPrimary: {
    ...elevation.soft,
  },
  buttonSecondary: {
    backgroundColor: palette.primarySoft,
    borderWidth: 1,
    borderColor: palette.primaryDark,
  },
  buttonGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.line },
  buttonContrast: { backgroundColor: palette.white },
  buttonDanger: { backgroundColor: palette.danger, borderColor: palette.danger },
  buttonAccessory: {
    width: 20,
    minHeight: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    flexShrink: 1,
    fontFamily: typography.strong,
    fontSize: 15,
    letterSpacing: 0.1,
    lineHeight: 20,
    textAlign: 'center',
  },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.4 },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.pill },

  metric: { flex: 1, minWidth: 90, gap: 3 },
  metricIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  metricValue: {
    color: palette.ink,
    fontFamily: typography.display,
    fontSize: 24,
  },
  metricLabel: { color: palette.muted, fontFamily: typography.body, fontSize: 12 },
  banner: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  bannerOffline: { backgroundColor: palette.warningSoft, borderColor: palette.warningLine },
  bannerError: { backgroundColor: palette.dangerSoft, borderColor: palette.danger },
  bannerCopy: { flex: 1, gap: 2 },
  bannerRetry: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  bannerTitle: { color: palette.ink, fontFamily: typography.strong, fontSize: 14 },
  bannerBody: { color: palette.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  stateScreen: { flexGrow: 1 },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateContainerShort: { justifyContent: 'flex-start' },

  stateScene: {
    width: '100%',
    maxWidth: 560,
    alignItems: 'center',
    gap: spacing.lg,
    alignSelf: 'center',
  },
  stateSceneCondensed: { gap: spacing.md, paddingVertical: spacing.md },
  stateSceneEditorial: {
    backgroundColor: palette.ink,
    borderColor: palette.inkSoft,
    ...elevation.floating,
  },
  stateSceneIcon: {
    borderRadius: radius.lg,
    backgroundColor: palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateSceneIconEditorial: { backgroundColor: palette.primarySoft },
  stateSceneIconDanger: { backgroundColor: palette.dangerSoft },
  stateSceneIconSuccess: { backgroundColor: palette.success },
  stateSceneCopy: { width: '100%', alignItems: 'center', gap: spacing.sm },
  stateSceneTitle: {
    color: palette.ink,
    fontFamily: typography.display,
    fontSize: 26,
    lineHeight: 32,
    textAlign: 'center',
  },
  stateSceneTitleEditorial: { color: palette.paper },
  stateSceneBody: {
    maxWidth: 430,
    color: palette.muted,
    fontFamily: typography.body,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  stateSceneBodyEditorial: { color: palette.surfaceDeep },
  stateSceneAction: { alignSelf: 'stretch' },
});
