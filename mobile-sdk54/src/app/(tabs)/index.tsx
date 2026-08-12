import { AppIcon } from '@/components/app-icon';
import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  AppScreen,
  Button,
  DataGate,
  ProgressBar,
  Reveal,
  ScreenHeader,
  SectionTitle,
  StatusBanner,
} from '@/components/ui';
import { elevation, palette, radius, spacing, typography } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { resolveContentLocale } from '@/lib/content-locale';
import { useFluidLayout } from '@/lib/use-fluid-layout';
import { useLocale } from '@/providers/locale-provider';
import { useRewards } from '@/providers/rewards-provider';
import { localize } from '@/types/scio';

export default function HomeScreen() {
  const { locale, t } = useLocale();
  const { state: rewards } = useRewards();
  const router = useRouter();
  const fluid = useFluidLayout();

  return (
    <DataGate>
      {(data) => {
        const lessons = data.curriculum.course.modules.flatMap((module) => module.lessons);
        const contentLocale = resolveContentLocale(data.curriculum.course.language, locale);
        const lessonIds = new Set(lessons.map(({ id }) => id));
        const completedIds = [...new Set(data.progress.completedLessonIds.filter((id) => lessonIds.has(id)))];
        const completed = completedIds.length;
        const courseProgress = lessons.length ? Math.round((completed / lessons.length) * 100) : 0;
        const nextLesson = lessons.find((lesson) => !completedIds.includes(lesson.id)) ?? lessons.at(-1);
        const streakLabel = rewards.streak.count === 1
          ? t('home.streakOne')
          : t('home.streak', { count: rewards.streak.count });

        return (
          <AppScreen>
            <ScreenHeader
              eyebrow={t('home.eyebrow')}
              title={data.curriculum.learnerName
                ? t('home.greeting', { name: data.curriculum.learnerName })
                : t('home.greetingFallback')}
              subtitle={t('home.subtitle')}
            />
            <StatusBanner />

            <Reveal>
              <View style={[styles.courseCard, { gap: fluid.sectionGap, padding: fluid.cardPadding }]}>
                <View style={styles.courseTopline}>
                  <View style={[styles.courseIndex, { width: fluid.controlSize, aspectRatio: 1 }]}>
                    <Text style={styles.courseIndexText}>01</Text>
                  </View>
                  <View style={styles.percentPill}>
                    <Text style={styles.percent}>{courseProgress}%</Text>
                  </View>
                </View>

                <View style={styles.courseCopy}>
                  <Text style={styles.courseKicker}>{t('home.nextLesson')}</Text>
                  <Text
                    style={[
                      styles.courseTitle,
                      { fontSize: fluid.titleSize * 0.9, lineHeight: fluid.titleLineHeight * 0.9 },
                    ]}>
                    {localize(data.curriculum.course.title, contentLocale)}
                  </Text>
                  {nextLesson ? <Text style={styles.nextLesson}>{localize(nextLesson.title, contentLocale)}</Text> : null}
                </View>

                <ProgressBar
                  value={courseProgress}
                  accessibilityLabel={t('a11y.progress', { value: courseProgress })}
                  trackColor={palette.inkSoft}
                  fillColor={palette.white}
                />
                <Button
                  label={t('home.resume')}
                  icon="arrow-right"
                  variant="contrast"
                  onPress={() => router.push('/courses')}
                />
              </View>
            </Reveal>

            <Reveal delay={60}>
              <View
                style={[
                  styles.metricsBand,
                  {
                    flexDirection: fluid.compact ? 'column' : 'row',
                    paddingVertical: fluid.cardPadding,
                    paddingHorizontal: fluid.cardPadding * 0.6,
                  },
                ]}>
                <View style={[styles.metric, fluid.compact && styles.metricCompact]} accessible accessibilityLabel={`XP: ${rewards.xp}`}>
                  <Text style={styles.metricValue}>{rewards.xp}</Text>
                  <Text style={styles.metricLabel}>XP</Text>
                </View>
                <View style={[styles.metricRule, fluid.compact && styles.metricRuleCompact]} />
                <View style={[styles.metric, fluid.compact && styles.metricCompact]} accessible accessibilityLabel={`${t('profile.mastery')}: ${rewards.mastery}%`}>
                  <Text style={styles.metricValue}>{rewards.mastery}%</Text>
                  <Text style={styles.metricLabel}>{t('profile.mastery')}</Text>
                </View>
                <View style={[styles.metricRule, fluid.compact && styles.metricRuleCompact]} />
                <View style={[styles.metric, fluid.compact && styles.metricCompact]} accessible accessibilityLabel={streakLabel}>
                  <Text style={styles.metricValue}>{rewards.streak.count}</Text>
                  <Text style={styles.metricLabel}>{streakLabel}</Text>
                </View>
              </View>
            </Reveal>

            <Reveal delay={100}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('home.createCourse')}
                onPress={() => {
                  haptics.light();
                  router.push('/create-course' as Href);
                }}
                style={({ pressed }) => [
                  styles.createBlock,
                  { gap: fluid.sectionGap, padding: fluid.cardPadding },
                  pressed && styles.pressed,
                ]}>
                <View style={styles.createTopline}>
                  <Text style={styles.createIndex}>NEW PATH</Text>
                  <View style={[styles.createArrow, { width: fluid.controlSize, aspectRatio: 1 }]}>
                    <AppIcon color={palette.white} name="arrow-right" size={fluid.controlSize * 0.42} />
                  </View>
                </View>
                <View style={styles.createCopy}>
                  <Text style={[styles.createTitle, { fontSize: fluid.titleSize * 0.72, lineHeight: fluid.titleLineHeight * 0.72 }]}>
                    {t('home.createCourse')}
                  </Text>
                  <Text style={styles.createHint}>{t('home.createCourseHint')}</Text>
                </View>
              </Pressable>
            </Reveal>

            <Reveal delay={140} style={styles.weekSection}>
              <SectionTitle>{t('home.weekly')}</SectionTitle>
              <View style={styles.weekSheet}>
                <View style={styles.weekRow}>
                  <View style={[styles.weekIcon, { width: fluid.controlSize, aspectRatio: 1 }]}>
                    <AppIcon name="book-complete" size={fluid.controlSize * 0.4} color={palette.primaryText} />
                  </View>
                  <Text style={styles.weekLabel}>{t('home.weeklyLessons')}</Text>
                  <Text style={styles.weekValue}>{data.progress.weeklyLessons}</Text>
                </View>
                <View style={styles.weekDivider} />
                <View style={styles.weekRow}>
                  <View style={[styles.weekIcon, { width: fluid.controlSize, aspectRatio: 1 }]}>
                    <AppIcon name="cards" size={fluid.controlSize * 0.4} color={palette.primaryText} />
                  </View>
                  <Text style={styles.weekLabel}>{t('home.weeklyReviews')}</Text>
                  <Text style={styles.weekValue}>{data.progress.weeklyReviews}</Text>
                </View>
              </View>
            </Reveal>
          </AppScreen>
        );
      }}
    </DataGate>
  );
}

const styles = StyleSheet.create({
  courseCard: {
    justifyContent: 'space-between',
    overflow: 'hidden',
    borderRadius: radius.xl,
    backgroundColor: palette.ink,
    ...elevation.floating,
  },
  courseTopline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  courseIndex: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.inkSoft,
  },
  courseIndexText: { color: palette.surfaceDeep, fontFamily: typography.mono, fontSize: 12 },
  percentPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: palette.white,
  },
  percent: { color: palette.primaryDark, fontFamily: typography.bold, fontSize: 12 },
  courseCopy: { gap: spacing.sm },
  courseKicker: {
    color: palette.primarySoft,
    fontFamily: typography.bold,
    fontSize: 10,
    letterSpacing: 1.35,
    textTransform: 'uppercase',
  },
  courseTitle: {
    color: palette.white,
    fontFamily: typography.display,
    letterSpacing: -1,
  },
  nextLesson: {
    color: palette.surfaceDeep,
    fontFamily: typography.body,
    fontSize: 16,
    lineHeight: 24,
  },
  metricsBand: {
    alignItems: 'stretch',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.surfaceDeep,
    backgroundColor: palette.paper,
  },
  metric: { flex: 1, minWidth: 0, justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  metricCompact: { width: '100%', flexDirection: 'row', justifyContent: 'space-between' },
  metricRule: { width: 1, backgroundColor: palette.surfaceDeep },
  metricRuleCompact: { width: '100%', height: 1 },
  metricValue: { color: palette.ink, fontFamily: typography.display, fontSize: 25, letterSpacing: -0.5 },
  metricLabel: { color: palette.muted, fontFamily: typography.medium, fontSize: 11, lineHeight: 15, textAlign: 'center' },
  createBlock: {
    justifyContent: 'space-between',
    borderRadius: radius.xl,
    backgroundColor: palette.primary,
  },
  createTopline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  createIndex: { color: palette.primarySoft, fontFamily: typography.bold, fontSize: 10, letterSpacing: 1.35 },
  createArrow: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primaryDark,
  },
  createCopy: { gap: spacing.sm },
  createTitle: { color: palette.white, fontFamily: typography.display, letterSpacing: -0.55 },
  createHint: { color: palette.primarySoft, fontFamily: typography.body, fontSize: 14, lineHeight: 21 },
  weekSection: { gap: spacing.md },
  weekSheet: {
    borderRadius: radius.lg,
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.surfaceDeep,
    paddingHorizontal: spacing.lg,
  },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  weekIcon: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primaryMist,
  },
  weekLabel: { flex: 1, color: palette.ink, fontFamily: typography.medium, fontSize: 14 },
  weekValue: { color: palette.ink, fontFamily: typography.display, fontSize: 22 },
  weekDivider: { height: 1, backgroundColor: palette.surfaceDeep },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
});
