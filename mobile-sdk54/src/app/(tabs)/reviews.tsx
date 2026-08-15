import { AppIcon } from '@/components/app-icon';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  AppScreen,
  Button,
  DataGate,
  Reveal,
  ScreenHeader,
  StateScene,
  StatusBanner,
  textStyles,
} from '@/components/ui';
import { layout, palette, radius, spacing, typography } from '@/constants/theme';
import { rewardAfterDurableMutation } from '@/lib/durable-reward';
import { haptics } from '@/lib/haptics';
import { resolveContentLocale } from '@/lib/content-locale';
import { reviewEmptyState } from '@/lib/review-empty-state';
import { createMutationLock } from '@/lib/mutation-lock';
import { selectDueCards } from '@/lib/review-schedule';
import { useFluidLayout } from '@/lib/use-fluid-layout';
import { useLocale } from '@/providers/locale-provider';
import { useScioData } from '@/providers/data-provider';
import { useRewards } from '@/providers/rewards-provider';
import { localize } from '@/types/scio';

export default function ReviewsScreen() {
  const { locale, t } = useLocale();
  const { reviewCard } = useScioData();
  const { grant } = useRewards();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const mutationLock = useRef(createMutationLock());
  const fluid = useFluidLayout();

  return (
    <DataGate>
      {(data) => {
        const contentLocale = resolveContentLocale(data.curriculum.course.language, locale);
        const dueCards = selectDueCards(data.cards, data.progress.recalledCardIds);
        const emptyState = reviewEmptyState(data.cards.length, dueCards.length);
        const safeIndex = Math.min(index, Math.max(0, dueCards.length - 1));
        const card = dueCards[safeIndex];
        const dueLabel =
          dueCards.length === 1
            ? t('reviews.dueOne')
            : t('reviews.due', { count: dueCards.length });

        const advance = () => {
          setRevealed(false);
          if (safeIndex < dueCards.length - 1) setIndex(safeIndex + 1);
        };

        const markAgain = async () => {
          if (!card) return;
          await mutationLock.current.run(async () => {
            setMutating(true);
            setSyncFailed(false);
            try {
              const eventId = `review_again:${card.id}:${new Date().toISOString().slice(0, 10)}`;
              const durable = await reviewCard(card.id, eventId, false);
              if (durable) {
                haptics.light();
                advance();
              } else {
                setSyncFailed(true);
              }
            } finally {
              setMutating(false);
            }
          });
        };

        const markRecalled = async () => {
          if (!card) return;
          await mutationLock.current.run(async () => {
            setMutating(true);
            setSyncFailed(false);
            try {
              const eventId = `review_recalled:${card.id}`;
              const event = { eventId, type: 'review_recalled' as const, occurredAt: new Date().toISOString() };
              const durable = await rewardAfterDurableMutation(
                () => reviewCard(card.id, eventId, true),
                grant,
                event,
              );
              if (durable) {
                haptics.success();
                setRevealed(false);
                setIndex(0);
              } else {
                setSyncFailed(true);
              }
            } finally {
              setMutating(false);
            }
          });
        };

        return (
          <AppScreen contentContainerStyle={styles.stateScreen}>
            <ScreenHeader
              eyebrow={t('reviews.eyebrow')}
              title={t('reviews.title')}
              subtitle={t('reviews.subtitle')}
            />
            <StatusBanner />
            <View style={styles.dueRow}>
              <AppIcon name="clock" size={18} color={palette.primaryText} />
              <Text style={styles.dueText}>{dueLabel}</Text>
            </View>

            {card ? (
              <>
                <Reveal key={card.id}>
                  <Pressable
                    accessibilityLabel={revealed ? localize(card.back, contentLocale) : t('a11y.reveal')}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: revealed }}
                    onPress={() => {
                      haptics.selection();
                      setRevealed(true);
                    }}
                    style={({ pressed }) => [
                      styles.flashcard,
                      { gap: fluid.sectionGap, padding: fluid.cardPadding },
                      pressed && styles.pressed,
                    ]}>
                    <View style={styles.cardTopline}>
                      <Text style={textStyles.label}>
                        {safeIndex + 1} {t('common.of')} {dueCards.length}
                      </Text>
                      <View style={[styles.brainChip, { width: fluid.controlSize * 0.8, aspectRatio: 1 }]}>
                        <AppIcon name="brain" size={fluid.controlSize * 0.42} color={palette.primaryText} />
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.cardQuestion,
                        { fontSize: fluid.titleSize * 0.76, lineHeight: fluid.titleLineHeight * 0.76 },
                      ]}>
                      {localize(card.front, contentLocale)}
                    </Text>
                    <View style={styles.cardRule} />
                    {revealed ? (
                      <View accessibilityLiveRegion="polite" style={styles.answer}>
                        <Text style={textStyles.label}>{t('reviews.answer')}</Text>
                        <Text style={styles.cardAnswer}>{localize(card.back, contentLocale)}</Text>
                      </View>
                    ) : (
                      <View style={styles.revealHint}>
                        <AppIcon name="hand-pointer" size={19} color={palette.muted} />
                        <Text style={textStyles.muted}>{t('reviews.tapToReveal')}</Text>
                      </View>
                    )}
                  </Pressable>
                </Reveal>
                {revealed ? (
                  <View style={styles.actions}>
                    <Button
                      busy={mutating}
                      disabled={mutating}
                      label={t('reviews.again')}
                      icon="refresh"
                      variant="ghost"
                      style={styles.action}
                      onPress={() => void markAgain()}
                    />
                    <Button
                      busy={mutating}
                      disabled={mutating}
                      label={t('reviews.recalled')}
                      icon="check"
                      style={styles.action}
                      onPress={() => void markRecalled()}
                    />
                  </View>
                ) : null}
                {syncFailed ? (
                  <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.syncError}>
                    {t('status.sync.failed')}
                  </Text>
                ) : null}
              </>
            ) : (
              <StateScene
                body={t(emptyState === 'no_cards' ? 'reviews.emptyBody' : 'reviews.completeBody')}
                icon={emptyState === 'no_cards' ? 'reviews' : 'check'}
                live
                style={styles.complete}
                title={t(emptyState === 'no_cards' ? 'reviews.empty' : 'reviews.complete')}
                tone={emptyState === 'no_cards' ? 'neutral' : 'success'}
              />
            )}
          </AppScreen>
        );
      }}
    </DataGate>
  );
}

const styles = StyleSheet.create({
  dueRow: { minHeight: layout.touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dueText: { color: palette.ink, fontFamily: typography.strong, fontSize: 14 },
  syncError: { color: palette.danger, fontFamily: typography.strong, fontSize: 14 },
  flashcard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    justifyContent: 'space-between',
  },
  cardTopline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brainChip: {
    borderRadius: radius.sm,
    backgroundColor: palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardQuestion: {
    color: palette.ink,
    fontFamily: typography.title,

    letterSpacing: -0.4,
  },
  cardRule: { height: 3, width: 44, borderRadius: 2, backgroundColor: palette.primary },
  answer: { gap: spacing.sm },
  cardAnswer: { color: palette.primaryText, fontFamily: typography.body, fontSize: 17, lineHeight: 26 },
  revealHint: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { flexDirection: 'column', gap: spacing.md },
  action: { width: '100%' },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  stateScreen: { flexGrow: 1 },
  complete: { flexGrow: 1, justifyContent: 'center' },
});
