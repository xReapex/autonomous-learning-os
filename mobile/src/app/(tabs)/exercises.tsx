import { AppIcon } from '@/components/app-icon';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  AppScreen,
  Button,
  DataGate,
  Reveal,
  ScreenHeader,
  StatusBanner,
  Surface,
  textStyles,
} from '@/components/ui';
import { layout, palette, radius, spacing, typography } from '@/constants/theme';
import { rewardAfterDurableMutation } from '@/lib/durable-reward';
import { selectNextExercise } from '@/lib/exercise-selection';
import { resolveContentLocale } from '@/lib/content-locale';
import { haptics } from '@/lib/haptics';
import { createMutationLock } from '@/lib/mutation-lock';
import { useFluidLayout } from '@/lib/use-fluid-layout';
import { useLocale } from '@/providers/locale-provider';
import { useScioData } from '@/providers/data-provider';
import { useRewards } from '@/providers/rewards-provider';
import { localize } from '@/types/scio';

type Feedback = 'correct' | 'incorrect' | 'select' | 'sync' | null;

export default function ExercisesScreen() {
  const { locale, t } = useLocale();
  const { passExercise } = useScioData();
  const { grant } = useRewards();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [mutating, setMutating] = useState(false);
  const mutationLock = useRef(createMutationLock());
  const fluid = useFluidLayout();

  return (
    <DataGate>
      {(data) => {
        const contentLocale = resolveContentLocale(data.curriculum.course.language, locale);
        const exercise = selectNextExercise(data.exercises, data.progress.passedExerciseIds);
        if (!exercise) {
          const complete = data.exercises.length > 0;
          return (
            <AppScreen>
              <ScreenHeader
                eyebrow={t('exercises.eyebrow')}
                title={t('exercises.title')}
                subtitle={t('exercises.subtitle')}
              />
              <Surface style={styles.empty}>
                <View
                  style={[
                    styles.emptyIcon,
                    { width: fluid.controlSize * 1.15, aspectRatio: 1 },
                    complete && styles.emptyIconComplete,
                  ]}>
                  <AppIcon
                    name={complete ? 'check' : 'exercises'}
                    size={26}
                    color={complete ? palette.onPrimary : palette.primaryText}
                  />
                </View>
                <Text style={styles.emptyTitle}>
                  {t(complete ? 'exercises.complete' : 'exercises.empty')}
                </Text>
                <Text style={[textStyles.muted, styles.center]}>
                  {t(complete ? 'exercises.completeBody' : 'exercises.emptyBody')}
                </Text>
              </Surface>
            </AppScreen>
          );
        }

        const currentExercise = data.exercises.findIndex(({ id }) => id === exercise.id) + 1;
        const checkAnswer = async () => {
          if (!selectedId) {
            haptics.selection();
            setFeedback('select');
            return;
          }
          if (selectedId !== exercise.correctOptionId) {
            haptics.warning();
            setFeedback('incorrect');
            return;
          }
          await mutationLock.current.run(async () => {
            setMutating(true);
            try {
              const eventId = `exercise_passed:${exercise.id}`;
              const event = { eventId, type: 'exercise_passed' as const, occurredAt: new Date().toISOString() };
              const durable = await rewardAfterDurableMutation(
                () => passExercise(exercise.id, eventId),
                grant,
                event,
              );
              if (durable) {
                haptics.success();
                setSelectedId(null);
                setFeedback(null);
              } else {
                setFeedback('sync');
              }
            } finally {
              setMutating(false);
            }
          });
        };

        return (
          <AppScreen>
            <ScreenHeader
              eyebrow={t('exercises.eyebrow')}
              title={t('exercises.title')}
              subtitle={t('exercises.subtitle')}
            />
            <StatusBanner />
            <Text style={textStyles.label}>
              {t('exercises.question', { current: currentExercise, total: data.exercises.length })}
            </Text>
            <Reveal>
              <Surface style={styles.questionCard}>
                <Text
                  accessibilityRole="header"
                  style={[styles.question, { fontSize: fluid.titleSize * 0.68, lineHeight: fluid.titleLineHeight * 0.68 }]}>
                  {localize(exercise.question, contentLocale)}
                </Text>
                <View accessibilityRole="radiogroup" style={styles.options}>
                  {exercise.options.map((option, index) => {
                    const selected = option.id === selectedId;
                    return (
                      <Pressable
                        key={option.id}
                        accessibilityLabel={t('a11y.answer', { answer: localize(option.label, contentLocale) })}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected, disabled: mutating }}
                        disabled={mutating}
                        onPress={() => {
                          haptics.selection();
                          setSelectedId(option.id);
                          setFeedback(null);
                        }}
                        style={({ pressed }) => [
                          styles.option,
                          selected && styles.optionSelected,
                          pressed && styles.pressed,
                        ]}>
                        <View
                          style={[
                            styles.radio,
                            { width: fluid.controlSize * 0.48, aspectRatio: 1 },
                            selected && styles.radioSelected,
                          ]}>
                          {selected ? <View style={[styles.radioDot, { width: '45%', aspectRatio: 1 }]} /> : null}
                        </View>
                        <Text style={styles.optionLetter}>{String.fromCharCode(65 + index)}</Text>
                        <Text style={styles.optionText}>{localize(option.label, contentLocale)}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {feedback ? (
                  <View
                    accessibilityRole="alert"
                    style={[
                      styles.feedback,
                      feedback === 'correct' ? styles.feedbackCorrect : styles.feedbackTry,
                    ]}>
                    <AppIcon
                      name={feedback === 'correct' ? 'check-circle' : 'info'}
                      size={21}
                      color={feedback === 'correct' ? palette.success : palette.amber}
                    />
                    <View style={styles.feedbackCopy}>
                      <Text style={styles.feedbackTitle}>
                        {t(
                          feedback === 'correct'
                            ? 'exercises.correct'
                            : feedback === 'select'
                              ? 'exercises.selectFirst'
                              : feedback === 'sync'
                                ? 'status.sync.failed'
                                : 'exercises.incorrect',
                        )}
                      </Text>
                      {feedback === 'incorrect' ? (
                        <Text style={textStyles.muted}>{localize(exercise.hint, contentLocale)}</Text>
                      ) : null}
                    </View>
                  </View>
                ) : null}

                <Button
                  busy={mutating}
                  disabled={mutating}
                  label={t('exercises.check')}
                  icon="arrow-right"
                  onPress={() => void checkAnswer()}
                />
              </Surface>
            </Reveal>
          </AppScreen>
        );
      }}
    </DataGate>
  );
}

const styles = StyleSheet.create({
  questionCard: { gap: spacing.xl },
  question: {
    color: palette.ink,
    fontFamily: typography.title,

    letterSpacing: -0.3,
  },
  options: { gap: spacing.md },
  option: {
    minHeight: layout.touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.surfaceRaised,
  },
  optionSelected: { borderColor: palette.primary, backgroundColor: palette.primarySoft },
  radio: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: palette.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: palette.primary },
  radioDot: { borderRadius: radius.pill, backgroundColor: palette.primary },
  optionLetter: { color: palette.primaryText, fontFamily: typography.bold },
  optionText: { flex: 1, color: palette.ink, fontFamily: typography.body, fontSize: 15, lineHeight: 21 },
  pressed: { opacity: 0.76 },
  feedback: {
    minHeight: layout.touchTarget,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  feedbackCorrect: { backgroundColor: palette.successSoft, borderColor: palette.successLine },
  feedbackTry: { backgroundColor: palette.warningSoft, borderColor: palette.warningLine },
  feedbackCopy: { flex: 1, gap: spacing.xs },
  feedbackTitle: { color: palette.ink, fontFamily: typography.strong, lineHeight: 21 },
  empty: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyIcon: {
    borderRadius: radius.lg,
    backgroundColor: palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyIconComplete: { backgroundColor: palette.success },
  emptyTitle: { color: palette.ink, fontFamily: typography.title, fontSize: 20, textAlign: 'center' },
  center: { textAlign: 'center' },
});
