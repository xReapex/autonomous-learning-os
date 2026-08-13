import { AppIcon } from '@/components/app-icon';
import { useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  AppScreen,
  Button,
  DataGate,
  ProgressBar,
  ScreenHeader,
  StatusBanner,
  Surface,
  textStyles,
} from '@/components/ui';
import { YouTubeVideo } from '@/components/youtube-video';
import { layout, palette, radius, spacing, typography } from '@/constants/theme';
import { rewardAfterDurableMutation } from '@/lib/durable-reward';
import { requestDestructiveConfirmation } from '@/lib/destructive-confirmation';
import { haptics } from '@/lib/haptics';
import { clearLessonDraft, updateLessonDraft } from '@/lib/lesson-drafts';
import { resolveContentLocale } from '@/lib/content-locale';
import { createMutationLock } from '@/lib/mutation-lock';
import { getVideoForLocale } from '@/lib/video-resources';
import { useFluidLayout } from '@/lib/use-fluid-layout';
import { useLocale } from '@/providers/locale-provider';
import { useRewards } from '@/providers/rewards-provider';
import { useScioData } from '@/providers/data-provider';
import { localize, type Lesson } from '@/types/scio';

export default function CoursesScreen() {
  const { locale, t } = useLocale();
  const { completeLesson, removeActiveCurriculum, saveNote } = useScioData();
  const { grant } = useRewards();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [mutationKey, setMutationKey] = useState<string | null>(null);
  const mutationLock = useRef(createMutationLock());
  const [qualifiedVideoKeys, setQualifiedVideoKeys] = useState<Set<string>>(() => new Set());
  const fluid = useFluidLayout();

  return (
    <DataGate>
      {(data) => {
        const lessons = data.curriculum.course.modules.flatMap((module) => module.lessons);
        const contentLocale = resolveContentLocale(data.curriculum.course.language, locale);
        const lessonIds = new Set(lessons.map(({ id }) => id));
        const completedIds = [...new Set(data.progress.completedLessonIds.filter((id) => lessonIds.has(id)))];
        const percent = lessons.length ? Math.round((completedIds.length / lessons.length) * 100) : 0;

        const removeSubject = async () => {
          await mutationLock.current.run(async () => {
            setMutationKey('curriculum:delete');
            try {
              const removed = await removeActiveCurriculum();
              if (removed) {
                haptics.success();
              } else {
                setMessage({ text: t('curriculum.removeError'), success: false });
              }
            } finally {
              setMutationKey(null);
            }
          });
        };

        const confirmRemoveSubject = () => {
          requestDestructiveConfirmation({
            platform: Platform.OS === 'web' ? 'web' : 'native',
            title: t('curriculum.removeConfirmTitle'),
            body: t('curriculum.removeConfirmBody'),
            cancelLabel: t('common.cancel'),
            confirmLabel: t('curriculum.remove'),
            action: () => void removeSubject(),
            webConfirm: (confirmation) =>
              typeof globalThis.confirm === 'function' && globalThis.confirm(confirmation),
            nativeAlert: (title, body, buttons) => Alert.alert(title, body, buttons),
          });
        };

        const finishLesson = async (lesson: Lesson) => {
          if (completedIds.includes(lesson.id)) return;
          await mutationLock.current.run(async () => {
            setMutationKey(`lesson:${lesson.id}`);
            try {
              const eventId = `lesson_completed:${lesson.id}`;
              const event = { eventId, type: 'lesson_completed' as const, occurredAt: new Date().toISOString() };
              const synced = await rewardAfterDurableMutation(
                () => completeLesson(lesson.id, eventId),
                grant,
                event,
              );
              if (synced) haptics.success();
              setMessage({ text: synced ? t('courses.completed') : t('status.sync.failed'), success: synced });
            } finally {
              setMutationKey(null);
            }
          });
        };

        const submitNote = async (lessonId: string) => {
          const body = noteDrafts[lessonId]?.trim();
          if (!body) return;
          await mutationLock.current.run(async () => {
            setMutationKey(`note:${lessonId}`);
            try {
              const synced = await saveNote({ lessonId, body });
              if (synced) haptics.success();
              setMessage({ text: synced ? t('courses.noteSaved') : t('status.sync.failed'), success: synced });
              if (synced) setNoteDrafts((current) => clearLessonDraft(current, lessonId));
            } finally {
              setMutationKey(null);
            }
          });
        };

        return (
          <AppScreen>
            <ScreenHeader
              eyebrow={t('courses.eyebrow')}
              title={t('courses.title')}
              subtitle={t('courses.subtitle')}
            />
            <StatusBanner />
            <View style={styles.progressBlock}>
              <Text style={textStyles.muted}>
                {t('courses.progress', { completed: completedIds.length, total: lessons.length })}
              </Text>
              <ProgressBar
                value={percent}
                accessibilityLabel={t('a11y.progress', { value: percent })}
              />
            </View>
            <Button
              busy={mutationKey === 'curriculum:delete'}
              disabled={mutationKey !== null}
              icon="delete"
              label={t('curriculum.remove')}
              onPress={confirmRemoveSubject}
              variant="danger"
            />

            {message ? (
              <Pressable
                accessibilityLiveRegion="polite"
                accessibilityLabel={`${message.text}. ${t('a11y.dismiss')}`}
                accessibilityRole="button"
                onPress={() => setMessage(null)}
                style={[styles.message, !message.success && styles.messageError]}>
                <AppIcon name={message.success ? 'check-circle' : 'info'} size={19} color={message.success ? palette.success : palette.danger} />
                <Text style={[styles.messageText, !message.success && styles.messageTextError]}>{message.text}</Text>
              </Pressable>
            ) : null}

            {data.curriculum.course.modules.map((module) => (
              <View key={module.id} style={styles.module}>
                <Text accessibilityRole="header" style={styles.moduleTitle}>
                  {localize(module.title, contentLocale)}
                </Text>
                {module.lessons.map((lesson) => {
                  const globalIndex = lessons.findIndex(({ id }) => id === lesson.id);
                  const completed = completedIds.includes(lesson.id);
                  const unlocked = globalIndex === 0 || completedIds.includes(lessons[globalIndex - 1].id);
                  const expanded = expandedId === lesson.id;
                  const video = getVideoForLocale(lesson, contentLocale);
                  const videoKey = `${lesson.id}:${contentLocale}:${video?.youtubeId ?? 'missing'}`;
                  const watchQualified = completed || qualifiedVideoKeys.has(videoKey);
                  return (
                    <Surface key={lesson.id} style={[styles.lesson, !unlocked && styles.locked]}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ expanded, disabled: !unlocked }}
                        disabled={!unlocked}
                        onPress={() => {
                          haptics.selection();
                          setExpandedId(expanded ? null : lesson.id);
                        }}
                        style={({ pressed }) => [styles.lessonHeader, pressed && styles.pressed]}>
                        <View
                          style={[
                            styles.lessonNumber,
                            { width: fluid.controlSize * 0.8, aspectRatio: 1 },
                            completed && styles.lessonNumberDone,
                          ]}>
                          {completed ? (
                            <AppIcon name="check" size={18} color={palette.onPrimary} />
                          ) : (
                            <Text style={styles.lessonNumberText}>{globalIndex + 1}</Text>
                          )}
                        </View>
                        <View style={styles.lessonCopy}>
                          <Text style={textStyles.label}>
                            {t('courses.lesson', { number: globalIndex + 1 })} ·{' '}
                            {t('common.minutes', { count: lesson.durationMinutes })}
                          </Text>
                          <Text style={textStyles.cardTitle}>{localize(lesson.title, contentLocale)}</Text>
                        </View>
                        <AppIcon
                          name={unlocked ? (expanded ? 'chevron-up' : 'chevron-down') : 'lock'}
                          size={22}
                          color={palette.muted}
                        />
                      </Pressable>
                      {!unlocked ? <Text style={textStyles.muted}>{t('courses.locked')}</Text> : null}
                      {expanded && unlocked ? (
                        <View style={styles.lessonDetails}>
                          {video ? (
                            <YouTubeVideo
                              key={videoKey}
                              video={video}
                              openLabel={t('courses.openYoutube')}
                              requiredWatchSeconds={lesson.durationMinutes * 60}
                              onQualified={() =>
                                setQualifiedVideoKeys((current) => {
                                  if (current.has(videoKey)) return current;
                                  const next = new Set(current);
                                  next.add(videoKey);
                                  return next;
                                })
                              }
                            />
                          ) : (
                            <Text accessibilityRole="alert" style={styles.videoError}>
                              {t('courses.videoUnavailable')}
                            </Text>
                          )}
                          <Text style={watchQualified ? styles.videoQualified : textStyles.muted}>
                            {watchQualified
                              ? t('courses.videoQualified')
                              : t('courses.videoWatchRequired', { count: lesson.durationMinutes })}
                          </Text>
                          <Button
                            busy={mutationKey === `lesson:${lesson.id}`}
                            label={completed ? t('courses.completed') : t('courses.complete')}
                            icon={completed ? 'check' : 'flag'}
                            disabled={completed || !watchQualified || mutationKey !== null}
                            onPress={() => void finishLesson(lesson)}
                          />
                          <Text style={textStyles.label}>{t('courses.noteLabel')}</Text>
                          <TextInput
                            accessibilityLabel={t('courses.noteLabel')}
                            editable={mutationKey === null}
                            multiline
                            onChangeText={(body) =>
                              setNoteDrafts((current) => updateLessonDraft(current, lesson.id, body))
                            }
                            placeholder={t('courses.notePlaceholder')}
                            placeholderTextColor={palette.faint}
                            style={[styles.noteInput, { minHeight: fluid.controlSize * 2 }]}
                            value={noteDrafts[lesson.id] ?? ''}
                          />
                          <Button
                            busy={mutationKey === `note:${lesson.id}`}
                            label={t('courses.saveNote')}
                            icon="save"
                            variant="secondary"
                            disabled={!noteDrafts[lesson.id]?.trim() || mutationKey !== null}
                            onPress={() => void submitNote(lesson.id)}
                          />
                        </View>
                      ) : null}
                    </Surface>
                  );
                })}
              </View>
            ))}
          </AppScreen>
        );
      }}
    </DataGate>
  );
}

const styles = StyleSheet.create({
  progressBlock: { gap: spacing.sm },
  module: { gap: spacing.md },
  moduleTitle: {
    color: palette.ink,
    fontFamily: typography.title,
    fontSize: 22,
    marginTop: spacing.sm,
  },
  lesson: { gap: spacing.md },
  locked: { opacity: 0.5 },
  lessonHeader: {
    minHeight: layout.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  lessonNumber: {
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceRaised,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonNumberDone: { backgroundColor: palette.success, borderColor: palette.success },
  lessonNumberText: { color: palette.ink, fontFamily: typography.strong },
  lessonCopy: { flex: 1, gap: spacing.xs },
  lessonDetails: { gap: spacing.lg, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: spacing.lg },
  videoError: { color: palette.danger, fontFamily: typography.body, fontSize: 15 },
  videoQualified: { color: palette.success, fontFamily: typography.strong, fontSize: 15 },
  noteInput: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceRaised,
    color: palette.ink,
    fontFamily: typography.body,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  message: {
    minHeight: layout.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.successLine,
    backgroundColor: palette.successSoft,
  },
  messageText: { flex: 1, color: palette.success, fontFamily: typography.strong },
  messageError: { borderColor: palette.danger, backgroundColor: palette.dangerSoft },
  messageTextError: { color: palette.danger },
  pressed: { opacity: 0.8 },
});
