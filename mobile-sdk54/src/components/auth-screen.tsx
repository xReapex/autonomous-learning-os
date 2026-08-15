import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLoader } from '@/components/brand-loader';
import { ScioMark } from '@/components/scio-mark';
import { Button, Reveal } from '@/components/ui';
import { elevation, palette, radius, spacing, typography } from '@/constants/theme';
import { openPublicScioPage, type PublicScioPage } from '@/lib/public-links';
import { useFluidLayout } from '@/lib/use-fluid-layout';
import { useAuth } from '@/providers/auth-provider';
import { useLocale } from '@/providers/locale-provider';

export function AuthScreen() {
  const { provider, retrySessionRestore, signInDevelopment, status } = useAuth();
  const { t } = useLocale();
  const fluid = useFluidLayout();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [legalLinkFailed, setLegalLinkFailed] = useState(false);
  const restoreFailed = status === 'restore-error';
  const expired = status === 'expired';
  const titleKey = restoreFailed
    ? 'auth.restoreFailedTitle'
    : provider === 'unavailable'
      ? 'auth.unavailableTitle'
      : 'auth.title';
  const bodyKey = restoreFailed
    ? 'auth.restoreFailedBody'
    : provider === 'unavailable'
      ? 'auth.unavailableBody'
      : 'auth.body';

  const connectDevelopmentProfile = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await signInDevelopment();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const openLegalPage = async (page: PublicScioPage) => {
    setLegalLinkFailed(false);
    const result = await openPublicScioPage(page, Linking.openURL);
    setLegalLinkFailed(result === 'failed');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View
          style={[
            styles.content,
            {
              width: fluid.contentWidth,
              paddingHorizontal: fluid.gutter,
              paddingTop: fluid.gutter,
              paddingBottom: fluid.gutter,
              gap: fluid.sectionGap,
            },
          ]}>
          <Reveal style={styles.brandBar}>
            <View style={[styles.markFrame, { width: fluid.controlSize, aspectRatio: 1 }]}>
              <ScioMark size={fluid.controlSize * 0.8} monochrome />
            </View>
            <Text style={styles.wordmark}>SCIO</Text>
          </Reveal>

          <Reveal delay={60} style={styles.editorial}>
            <Text style={styles.index}>01 — {t('auth.tagline')}</Text>
            <Text accessibilityRole="header" style={[styles.statement, { fontSize: fluid.titleSize * 1.14, lineHeight: fluid.titleLineHeight * 1.14 }]}>
              {t(titleKey)}
            </Text>
            <Text style={styles.introduction}>
              {t(bodyKey)}
            </Text>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.rule}>
              <View style={styles.ruleFill} />
            </View>
          </Reveal>

          {status === 'checking' ? (
            <View style={styles.loading}>
              <BrandLoader caption={t('auth.checking')} />
            </View>
          ) : (
            <Reveal delay={120} style={[styles.actionSheet, { padding: fluid.cardPadding }]}>
              <View style={styles.sheetTopline}>
                <Text style={styles.sheetIndex}>ACCESS</Text>
                {provider === 'development' ? (
                  <Text style={styles.previewBadge}>{t('auth.developmentEyebrow')}</Text>
                ) : null}
              </View>

              {restoreFailed ? (
                <Button label={t('auth.retry')} onPress={() => void retrySessionRestore()} />
              ) : null}

              {!restoreFailed && expired ? (
                <Text accessibilityLiveRegion="polite" style={styles.statusNotice}>
                  {t('auth.expiredBody')}
                </Text>
              ) : null}

              {!restoreFailed && provider === 'development' ? (
                <>
                  <Button
                    busy={busy}
                    disabled={busy}
                    icon="user"
                    label={t('auth.continueDevelopment')}
                    onPress={() => void connectDevelopmentProfile()}
                  />
                  <Text style={styles.note}>{t('auth.developmentNote')}</Text>
                </>
              ) : null}

              {!restoreFailed && failed ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {t(provider === 'development' ? 'auth.errorDevelopment' : 'auth.errorSocial')}
                </Text>
              ) : null}

              <View style={styles.legalLinks}>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => void openLegalPage('privacy')}
                  style={styles.legalLink}>
                  <Text style={styles.legalText}>{t('auth.privacy')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => void openLegalPage('terms')}
                  style={styles.legalLink}>
                  <Text style={styles.legalText}>{t('auth.terms')}</Text>
                </Pressable>
              </View>
              {legalLinkFailed ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {t('auth.legalLinkError')}
                </Text>
              ) : null}
            </Reveal>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.canvas },
  scrollContent: { flexGrow: 1 },
  content: {
    width: '100%',
    minHeight: '100%',
    alignSelf: 'center',
    justifyContent: 'space-between',
  },
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  markFrame: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.surfaceDeep,
  },
  wordmark: {
    color: palette.ink,
    fontFamily: typography.brand,
    fontSize: 19,
    letterSpacing: 4.8,
  },
  editorial: { flex: 1, justifyContent: 'center', gap: spacing.lg, paddingVertical: spacing.xxl },
  index: {
    color: palette.primaryText,
    fontFamily: typography.bold,
    fontSize: 10,
    letterSpacing: 1.35,
    textTransform: 'uppercase',
  },
  statement: {
    color: palette.ink,
    fontFamily: typography.display,
    letterSpacing: -1.45,
  },
  introduction: {
    color: palette.muted,
    fontFamily: typography.body,
    fontSize: 17,
    lineHeight: 26,
  },
  rule: { width: '100%', height: 4, marginTop: spacing.sm, backgroundColor: palette.surfaceDeep },
  ruleFill: { width: '28%', height: '100%', backgroundColor: palette.primary },
  loading: { flex: 1, justifyContent: 'center' },
  actionSheet: {
    gap: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.surfaceDeep,
    ...elevation.soft,
  },
  sheetTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  sheetIndex: { color: palette.faint, fontFamily: typography.bold, fontSize: 10, letterSpacing: 1.4 },
  previewBadge: {
    color: palette.primaryText,
    fontFamily: typography.bold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: palette.primaryMist,
  },
  note: { color: palette.faint, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  statusNotice: {
    color: palette.primaryText,
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 21,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.primaryMist,
  },
  error: { color: palette.danger, fontFamily: typography.body, fontSize: 14, lineHeight: 20 },
  legalLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  legalLink: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md },
  legalText: { color: palette.primaryText, fontFamily: typography.medium, fontSize: 13, textDecorationLine: 'underline' },
});
