import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppIcon, type AppIconName } from '@/components/app-icon';
import { ProgressBar } from '@/components/ui';
import { palette, radius, spacing, typography } from '@/constants/theme';
import { useFluidLayout } from '@/lib/use-fluid-layout';
import { useLocale } from '@/providers/locale-provider';

export function GenerationProgressCard({
  body,
  icon,
  progress,
  status,
  step,
  style,
  title,
  totalSteps,
  tone = 'active',
}: {
  body?: string;
  icon: AppIconName;
  progress: number | null;
  status: string;
  step: number;
  style?: StyleProp<ViewStyle>;
  title: string;
  totalSteps: number;
  tone?: 'active' | 'ready';
}) {
  const { t } = useLocale();
  const fluid = useFluidLayout();
  const largeText = fluid.largeText;
  const stepLabel = t('generation.step', { current: step, total: totalSteps });
  const indeterminate = progress === null;
  const valueLabel = indeterminate ? null : t('generation.progress.value', { value: progress });
  const accessibilityLabel = [status, title, body, stepLabel, valueLabel].filter(Boolean).join('. ');
  const iconColor = tone === 'ready' ? palette.onPrimary : palette.primaryText;

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      accessibilityValue={indeterminate ? undefined : { min: 0, max: 100, now: progress }}
      style={[
        styles.card,
        { padding: fluid.gutter * 0.72 },
        largeText && styles.largeText,
        tone === 'ready' && styles.readyCard,
        style,
      ]}>
      <View style={[
        styles.iconFrame,
        { minWidth: fluid.controlSize * 0.88, minHeight: fluid.controlSize * 0.88 },
        largeText && styles.iconFrameLargeText,
        tone === 'ready' && styles.readyIcon,
      ]}>
        <AppIcon color={iconColor} name={icon} size={22} strokeWidth={1.9} />
      </View>

      <View style={[styles.content, largeText && styles.contentLargeText]}>
        <View style={[styles.topline, largeText && styles.toplineLargeText]}>
          <Text style={[styles.status, tone === 'ready' && styles.readyStatus]}>{status}</Text>
          <Text style={[styles.step, tone === 'ready' && styles.readyMeta]}>{stepLabel}</Text>
        </View>
        <Text style={[styles.title, tone === 'ready' && styles.readyTitle]}>{title}</Text>
        {body ? <Text style={[styles.body, tone === 'ready' && styles.readyBody]}>{body}</Text> : null}
        <View style={styles.progressArea}>
          <ProgressBar
            accessibilityLabel={accessibilityLabel}
            fillColor={tone === 'ready' ? palette.white : palette.primary}
            hiddenFromAccessibility
            indeterminate={indeterminate}
            trackColor={tone === 'ready' ? palette.primaryLight : palette.surfaceRaised}
            value={progress ?? 0}
          />
          {valueLabel ? <Text style={[styles.value, tone === 'ready' && styles.readyMeta]}>{valueLabel}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: palette.surfaceDeep,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
  },
  readyCard: {
    borderColor: palette.primaryDark,
    backgroundColor: palette.primaryDark,
  },
  largeText: { flexDirection: 'column', alignItems: 'stretch' },
  iconFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: palette.primarySoft,
  },
  iconFrameLargeText: { alignSelf: 'center' },
  readyIcon: { backgroundColor: palette.primaryLight },
  content: { flex: 1, minWidth: 0, gap: spacing.xs },
  contentLargeText: { flex: 0, width: '100%' },
  topline: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  toplineLargeText: { flexDirection: 'column', alignItems: 'flex-start' },
  status: {
    flexShrink: 1,
    color: palette.primaryText,
    fontFamily: typography.bold,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  step: { color: palette.muted, fontFamily: typography.medium, fontSize: 12 },
  title: { color: palette.ink, fontFamily: typography.title, fontSize: 17, lineHeight: 22 },
  body: { color: palette.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  progressArea: { marginTop: spacing.xs, gap: spacing.xs },
  value: { alignSelf: 'flex-end', color: palette.primaryText, fontFamily: typography.bold, fontSize: 12 },
  readyStatus: { color: palette.primarySoft },
  readyTitle: { color: palette.white },
  readyBody: { color: palette.primarySoft },
  readyMeta: { color: palette.primarySoft },
});
