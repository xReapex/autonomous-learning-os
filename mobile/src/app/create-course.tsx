import { type Href, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  findNodeHandle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { GenerationProgressCard } from '@/components/generation-progress-card';
import { Button, Reveal, Surface, textStyles } from '@/components/ui';
import { layout, palette, radius, spacing, typography } from '@/constants/theme';
import {
  beginEngineInterview,
  EngineApiError,
  sendEngineInterview,
  type EngineInterviewResponse,
} from '@/lib/engine-api';
import { haptics } from '@/lib/haptics';
import type { TranslationKey } from '@/lib/i18n';
import { createMutationLock } from '@/lib/mutation-lock';
import { advanceInterviewProgress, resolveInterviewProgress } from '@/lib/generation-progress';
import { useFluidLayout } from '@/lib/use-fluid-layout';
import { useAuth } from '@/providers/auth-provider';
import { useCourseGeneration } from '@/providers/course-generation-provider';
import { useScioData } from '@/providers/data-provider';
import { useLocale } from '@/providers/locale-provider';
import { useOverlayInset } from '@/providers/overlay-inset-provider';

type Stage = 'subject' | 'question' | 'confirmation' | 'preview' | 'activated';
type Turn = { role: 'assistant' | 'user'; content: string };

export default function CreateCourseScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { locale, t } = useLocale();
  const { activateGeneratedCurriculum } = useScioData();
  const { clear: clearGeneration, start: startGeneration, state: generation } = useCourseGeneration();
  const [stage, setStage] = useState<Stage>('subject');
  const [subject, setSubject] = useState('');
  const [answer, setAnswer] = useState('');
  const [questionChoices, setQuestionChoices] = useState<string[]>([]);
  const [customAnswer, setCustomAnswer] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [stateToken, setStateToken] = useState('');
  const [progress, setProgress] = useState(0);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [errorCode, setErrorCode] = useState<EngineApiError['code'] | null>(null);
  const [busy, setBusy] = useState(false);
  const stageHeading = useRef<Text>(null);
  const interviewLock = useRef(createMutationLock());
  const activationLock = useRef(createMutationLock());
  const fluid = useFluidLayout();
  const { overlayInset } = useOverlayInset();

  const fail = (error: unknown) => {
    const code = error instanceof EngineApiError ? error.code : 'invalid';
    if (code === 'unauthorized') void signOut().catch(() => undefined);
    setErrorCode(code);
  };

  const acceptResponse = (response: EngineInterviewResponse, userAnswer?: string) => {
    setStateToken(response.state);
    setProgress((current) => advanceInterviewProgress(current, response.progress));
    if (userAnswer) setTurns((current) => [...current, { role: 'user', content: userAnswer }]);
    if (response.phase === 'question') {
      setQuestionChoices(response.choices);
      setCustomAnswer(false);
      setSelectedChoice(null);
      setAnswer('');
      setTurns((current) => [...current, { role: 'assistant', content: response.message }]);
      setStage('question');
      return;
    }
    if (response.phase === 'confirmation') {
      setQuestionChoices([]);
      setCustomAnswer(false);
      setTurns((current) => [...current, { role: 'assistant', content: response.message }]);
      setStage('confirmation');
      return;
    }
    throw new EngineApiError('invalid');
  };

  const start = async () => {
    const normalized = subject.trim();
    if (normalized.length < 2) return;
    await interviewLock.current.run(async () => {
      setBusy(true);
      setErrorCode(null);
      setTurns([]);
      try {
        const response = await beginEngineInterview(locale, normalized);
        acceptResponse(response, normalized);
      } catch (error) {
        fail(error);
      } finally {
        setBusy(false);
      }
    });
  };

  const submitAnswer = async (value: string, revise = false) => {
    const normalized = value.trim();
    if (!normalized || !stateToken) return;
    await interviewLock.current.run(async () => {
      setBusy(true);
      setErrorCode(null);
      try {
        const response = await sendEngineInterview(
          revise
            ? { state: stateToken, action: 'revise', answer: normalized }
            : { state: stateToken, answer: normalized },
        );
        setAnswer('');
        acceptResponse(response, normalized);
      } catch (error) {
        fail(error);
      } finally {
        setBusy(false);
      }
    });
  };

  const sendAnswer = (revise = false) => submitAnswer(answer, revise);
  const sendChoice = async (choice: string) => {
    haptics.selection();
    setSelectedChoice(choice);
    await submitAnswer(choice);
    setSelectedChoice(null);
  };

  const generate = () => {
    if (!stateToken) return;
    setErrorCode(null);
    if (startGeneration(stateToken, locale)) router.replace('/' as Href);
  };

  const proposal = generation.status === 'ready' ? generation.proposal : null;
  const visibleStage = proposal && stage !== 'activated' ? 'preview' : stage;
  const interviewProgress = visibleStage === 'question'
    ? resolveInterviewProgress('question', progress, busy)
    : visibleStage === 'confirmation'
      ? resolveInterviewProgress('confirmation', progress, busy)
      : visibleStage === 'subject' && busy
        ? resolveInterviewProgress('starting', 0, true)
        : null;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const node = findNodeHandle(stageHeading.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    });
    return () => cancelAnimationFrame(frame);
  }, [visibleStage]);

  const activate = async () => {
    if (!proposal) return;
    await activationLock.current.run(async () => {
      setBusy(true);
      try {
        const result = await activateGeneratedCurriculum(proposal);
        if (!result.ok) {
          if (result.code === 'unauthorized') void signOut().catch(() => undefined);
          setErrorCode(result.code);
          return;
        }
        haptics.success();
        clearGeneration();
        setStage('activated');
      } finally {
        setBusy(false);
      }
    });
  };

  const discardProposal = () => {
    clearGeneration();
    setStateToken('');
    setProgress(0);
    setTurns([]);
    setErrorCode(null);
    setStage('subject');
  };

  const lessonCount = proposal?.curriculum.course.modules.reduce((total, module) => total + module.lessons.length, 0) ?? 0;
  const currentQuestion = [...turns].reverse().find((turn) => turn.role === 'assistant')?.content ?? '';
  const answerCount = turns.filter((turn) => turn.role === 'user').length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={[styles.topbar, { minHeight: fluid.controlSize, paddingHorizontal: fluid.gutter }]}>
          <Pressable
            accessibilityLabel={t('common.back')}
            accessibilityRole="button"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={styles.back}>
            <AppIcon color={palette.ink} name="arrow-left" size={22} />
          </Pressable>
          <Text style={styles.brand}>SCIO</Text>
          <View style={styles.back} />
        </View>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              width: fluid.contentWidth,
              paddingHorizontal: fluid.gutter,
              paddingTop: fluid.gutter,
              paddingBottom: fluid.sectionGap + overlayInset,
              gap: fluid.sectionGap,
            },
          ]}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {visibleStage === 'subject' ? (
            <View style={styles.header}>
              <Text style={styles.eyebrow}>{t('engine.eyebrow')}</Text>
              <Text
                ref={stageHeading}
                accessibilityLiveRegion="polite"
                accessibilityRole="header"
                style={[styles.title, { fontSize: fluid.titleSize, lineHeight: fluid.titleLineHeight }]}>
                {t('engine.title')}
              </Text>
              <Text style={styles.subtitle}>{t('engine.subtitle')}</Text>
            </View>
          ) : null}

          {interviewProgress ? (
            <GenerationProgressCard
              icon={interviewProgress.icon}
              progress={interviewProgress.progress}
              status={t(interviewProgress.statusKey)}
              step={interviewProgress.step}
              title={t(interviewProgress.titleKey)}
              totalSteps={interviewProgress.totalSteps}
            />
          ) : null}

          {errorCode ? (
            <View accessibilityRole="alert" style={styles.error}>
              <AppIcon color={palette.danger} name="info" size={19} />
              <Text style={styles.errorText}>{t(`engine.error.${errorCode}` as TranslationKey)}</Text>
            </View>
          ) : null}

          {visibleStage === 'subject' ? (
            <Reveal>
              <Surface style={styles.card}>
                <Text style={styles.cardTitle}>{t('engine.subjectLabel')}</Text>
                <Text style={textStyles.muted}>{t('home.createCourseHint')}</Text>
                <TextInput
                  accessibilityLabel={t('engine.subjectLabel')}
                  multiline
                  onChangeText={setSubject}
                  placeholder={t('engine.subjectPlaceholder')}
                  placeholderTextColor={palette.faint}
                  style={[styles.input, styles.subjectInput, { minHeight: fluid.controlSize * 2.4 }]}
                  value={subject}
                />
                <Button disabled={busy || subject.trim().length < 2} label={t('engine.start')} onPress={() => void start()} />
              </Surface>
            </Reveal>
          ) : null}

          {visibleStage === 'question' ? (
            <View style={styles.wizard}>
              <View style={styles.topicLine}>
                <Text style={styles.topicLabel}>{t('engine.subjectContext')}</Text>
                <Text style={styles.topicText}>{subject}</Text>
              </View>
              <Text style={styles.questionStep}>{t('engine.questionStep', { value: Math.max(1, answerCount) })}</Text>
              <Text
                ref={stageHeading}
                accessibilityLiveRegion="polite"
                accessibilityRole="header"
                style={[
                  styles.questionTitle,
                  { fontSize: fluid.titleSize * 0.78, lineHeight: fluid.titleLineHeight * 0.78 },
                ]}>
                {currentQuestion}
              </Text>
              <Text style={styles.choiceHint}>{t('engine.choiceHint')}</Text>

              <View style={styles.choiceList}>
                {questionChoices.map((choice, index) => {
                  const selected = selectedChoice === choice;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      key={choice}
                      onPress={() => void sendChoice(choice)}
                      style={({ pressed }) => [
                        styles.choiceButton,
                        (pressed || selected) && styles.choiceButtonActive,
                        busy && !selected && styles.choiceButtonMuted,
                      ]}
                    >
                      <View
                        style={[
                          styles.choiceMarker,
                          { width: fluid.controlSize * 0.65, aspectRatio: 1 },
                          selected && styles.choiceMarkerActive,
                        ]}>
                        <Text style={[styles.choiceMarkerText, selected && styles.choiceMarkerTextActive]}>{String.fromCharCode(65 + index)}</Text>
                      </View>
                      <Text style={styles.choiceText}>{choice}</Text>
                      <View style={[styles.choiceAccessory, { width: fluid.controlSize * 0.65 }]}>
                        {selected && busy
                          ? <ActivityIndicator color={palette.primary} size="small" />
                          : <AppIcon color={palette.faint} name="chevron-right" size={19} strokeWidth={1.8} />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {!customAnswer ? (
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => setCustomAnswer(true)} style={styles.otherAnswer}>
                  <Text style={styles.otherAnswerText}>{t('engine.otherAnswer')}</Text>
                </Pressable>
              ) : (
                <View style={styles.customAnswer}>
                  <Text style={styles.customAnswerLabel}>{t('engine.otherAnswerLabel')}</Text>
                  <TextInput
                    accessibilityLabel={t('engine.answerPlaceholder')}
                    autoFocus
                    multiline
                    onChangeText={setAnswer}
                    placeholder={t('engine.answerPlaceholder')}
                    placeholderTextColor={palette.faint}
                    style={[styles.input, styles.answerInput, { minHeight: fluid.controlSize * 2 }]}
                    value={answer}
                  />
                  <Button disabled={busy || !answer.trim()} label={t('engine.send')} onPress={() => void sendAnswer()} />
                </View>
              )}
            </View>
          ) : null}

          {visibleStage === 'confirmation' ? (
            <View style={styles.review}>
              <Text style={styles.questionStep}>{t('engine.confirmationEyebrow')}</Text>
              <Text
                ref={stageHeading}
                accessibilityLiveRegion="polite"
                accessibilityRole="header"
                style={[
                  styles.questionTitle,
                  { fontSize: fluid.titleSize * 0.78, lineHeight: fluid.titleLineHeight * 0.78 },
                ]}>
                {t('engine.confirmationTitle')}
              </Text>
              <View style={styles.reviewDocument}>
                <Text style={styles.reviewText}>{currentQuestion}</Text>
              </View>
              <Button disabled={busy} label={t('engine.confirm')} onPress={generate} />
              <View style={styles.revisionArea}>
                <TextInput
                  accessibilityLabel={t('engine.revisePlaceholder')}
                  multiline
                  onChangeText={setAnswer}
                  placeholder={t('engine.revisePlaceholder')}
                  placeholderTextColor={palette.faint}
                  style={[styles.input, styles.revisionInput, { minHeight: fluid.controlSize * 1.8 }]}
                  value={answer}
                />
                <Button disabled={busy || !answer.trim()} label={t('engine.revise')} onPress={() => void sendAnswer(true)} variant="ghost" />
              </View>
            </View>
          ) : null}

          {visibleStage === 'preview' && proposal ? (
            <View style={styles.preview}>
              <View style={styles.previewHeader}>
                <AppIcon color={palette.success} name="check-circle" size={28} />
                <View style={styles.flex}>
                  <Text ref={stageHeading} accessibilityLiveRegion="polite" accessibilityRole="header" style={styles.cardTitle}>{t('engine.previewTitle')}</Text>
                  <Text style={textStyles.muted}>{t('engine.previewBody', { lessons: lessonCount, videos: lessonCount })}</Text>
                </View>
              </View>
              {proposal.curriculum.course.modules.map((module) => (
                <Surface key={module.id} style={styles.moduleCard}>
                  <Text style={styles.moduleTitle}>{module.title[locale]}</Text>
                  {module.lessons.map((lesson) => (
                    <View key={lesson.id} style={styles.lessonRow}>
                      <View style={styles.lessonDot} />
                      <View style={styles.flex}>
                        <Text style={styles.lessonTitle}>{lesson.title[locale]}</Text>
                        <Text style={textStyles.muted}>{lesson.videos[locale]?.provider}</Text>
                      </View>
                    </View>
                  ))}
                </Surface>
              ))}
              <Button busy={busy} disabled={busy} label={t('engine.activate')} onPress={() => void activate()} />
              <Button
                disabled={busy}
                label={t('generation.preview.discard')}
                onPress={discardProposal}
                variant="ghost"
              />
            </View>
          ) : null}

          {visibleStage === 'activated' ? (
            <Surface style={styles.generating}>
              <View style={[styles.activatedIcon, { width: fluid.controlSize * 1.1, aspectRatio: 1 }]}>
                <AppIcon color={palette.onPrimary} name="check" size={fluid.controlSize * 0.52} />
              </View>
              <Text ref={stageHeading} accessibilityLiveRegion="polite" accessibilityRole="header" style={[styles.cardTitle, styles.center]}>{t('engine.activated')}</Text>
              <Button label={t('home.resume')} onPress={() => router.replace('/courses')} />
            </Surface>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: palette.canvas },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: layout.touchTarget, height: layout.touchTarget, alignItems: 'center', justifyContent: 'center' },
  brand: { color: palette.ink, fontFamily: typography.brand, fontSize: 17, letterSpacing: 4 },
  content: { width: '100%', alignSelf: 'center' },
  header: { alignItems: 'flex-start', gap: spacing.sm, paddingTop: spacing.lg },
  eyebrow: { color: palette.primaryText, fontFamily: typography.bold, fontSize: 11, letterSpacing: 1.6 },
  title: { color: palette.ink, fontFamily: typography.display, letterSpacing: -0.6 },
  subtitle: { color: palette.muted, fontFamily: typography.body, fontSize: 16, lineHeight: 24 },
  card: { gap: spacing.md },
  cardTitle: { color: palette.ink, fontFamily: typography.title, fontSize: 21, lineHeight: 27 },
  input: { minHeight: layout.touchTarget, borderWidth: 1, borderColor: palette.line, borderRadius: radius.md, backgroundColor: palette.surfaceRaised, color: palette.ink, fontFamily: typography.body, fontSize: 16, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  subjectInput: { textAlignVertical: 'top' },
  answerInput: { textAlignVertical: 'top' },
  error: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: palette.dangerSoft, borderWidth: 1, borderColor: palette.danger },
  errorText: { flex: 1, color: palette.danger, fontFamily: typography.body, lineHeight: 21 },
  wizard: { gap: spacing.lg },
  topicLine: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: palette.line },
  topicLabel: { color: palette.faint, fontFamily: typography.bold, fontSize: 10, letterSpacing: 1.3 },
  topicText: { flex: 1, color: palette.ink, fontFamily: typography.strong, fontSize: 14, lineHeight: 20 },
  questionStep: { marginTop: spacing.sm, color: palette.primaryText, fontFamily: typography.bold, fontSize: 10, letterSpacing: 1.5 },
  questionTitle: { color: palette.ink, fontFamily: typography.title, letterSpacing: -0.4 },
  choiceHint: { marginTop: -spacing.sm, color: palette.muted, fontFamily: typography.body, fontSize: 14, lineHeight: 20 },
  choiceList: { gap: spacing.sm },
  choiceButton: { minHeight: layout.touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderWidth: 1, borderColor: palette.line, borderRadius: radius.md, backgroundColor: palette.surfaceRaised },
  choiceButtonActive: { borderColor: palette.primary, backgroundColor: palette.primarySoft },
  choiceButtonMuted: { opacity: 0.45 },
  choiceMarker: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: palette.canvas },
  choiceMarkerActive: { backgroundColor: palette.primary },
  choiceMarkerText: { color: palette.muted, fontFamily: typography.mono, fontSize: 12 },
  choiceMarkerTextActive: { color: palette.onPrimary },
  choiceAccessory: { alignItems: 'center', justifyContent: 'center' },
  choiceText: { flex: 1, color: palette.ink, fontFamily: typography.strong, fontSize: 15, lineHeight: 21 },
  otherAnswer: { minHeight: layout.touchTarget, alignSelf: 'flex-start', justifyContent: 'center', paddingRight: spacing.md },
  otherAnswerText: { color: palette.primaryText, fontFamily: typography.strong, fontSize: 14, textDecorationLine: 'underline' },
  customAnswer: { gap: spacing.md, paddingTop: spacing.sm },
  customAnswerLabel: { color: palette.ink, fontFamily: typography.strong, fontSize: 14 },
  review: { gap: spacing.lg },
  reviewDocument: { paddingVertical: spacing.xl, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.line },
  reviewText: { color: palette.ink, fontFamily: typography.body, fontSize: 16, lineHeight: 25 },
  revisionArea: { gap: spacing.sm, paddingTop: spacing.md },
  revisionInput: { textAlignVertical: 'top' },
  generating: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  activatedIcon: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.success },
  center: { textAlign: 'center' },
  preview: { gap: spacing.lg },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  moduleCard: { gap: spacing.md },
  moduleTitle: { color: palette.primaryText, fontFamily: typography.bold, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase' },
  lessonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingTop: spacing.sm },
  lessonDot: { width: 8, height: 8, marginTop: 7, borderRadius: 4, backgroundColor: palette.accent },
  lessonTitle: { color: palette.ink, fontFamily: typography.strong, fontSize: 15, lineHeight: 21 },
});
