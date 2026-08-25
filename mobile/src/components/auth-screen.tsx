import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLoader } from '@/components/brand-loader';
import { ScioMark } from '@/components/scio-mark';
import { Button, Reveal } from '@/components/ui';
import { palette, radius, spacing, typography } from '@/constants/theme';
import { useFluidLayout } from '@/lib/use-fluid-layout';
import { openPublicScioPage, type PublicScioPage } from '@/lib/public-links';
import { useAuth } from '@/providers/auth-provider';
import { useLocale } from '@/providers/locale-provider';

export function AuthScreen() {
  const { provider, retrySessionRestore, signInDevelopment, signInSocial, status } = useAuth();
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

  const connectSocialAccount = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await signInSocial();
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
          <Reveal style={[styles.heroPanel, { padding: fluid.cardPadding }]}>
            <View style={styles.brandBar}>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[styles.markFrame, { width: fluid.controlSize, aspectRatio: 1 }]}>
                <ScioMark size={fluid.controlSize * 0.8} monochrome />
              </View>
              <Text style={styles.wordmark}>SCIO</Text>
            </View>

            <View style={styles.heroBody}>
              {!fluid.compact ? (
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={styles.editorialSpine}>
                  <Text style={styles.spineIndex}>01</Text>
                  <View style={styles.spineRule} />
                </View>
              ) : null}
              <View style={styles.editorial}>
                <Text style={styles.index}>{t('auth.tagline')}</Text>
                <Text
                  accessibilityRole="header"
                  style={[
                    styles.statement,
                    { fontSize: fluid.titleSize * 1.14, lineHeight: fluid.titleLineHeight * 1.14 },
                  ]}>
                  {t(titleKey)}
                </Text>
                <Text style={styles.introduction}>{t(bodyKey)}</Text>
              </View>
            </View>
          </Reveal>

          {status === 'checking' ? (
            <View style={styles.loading}>
              <BrandLoader caption={t('auth.checking')} />
            </View>
          ) : (
            <Reveal delay={120} style={[styles.accessPanel, { padding: fluid.cardPadding }]}>
              <View style={[styles.sheetTopline, fluid.compact && styles.sheetToplineLargeText]}>
                <Text accessibilityRole="header" style={styles.sheetIndex}>{t('auth.accessEyebrow')}</Text>
                {provider === 'development' ? (
                  <Text style={styles.previewBadge}>{t('auth.developmentEyebrow')}</Text>
                ) : null}
              </View>

              {restoreFailed ? (
                <Button
                  label={t('auth.retry')}
                  onPress={() => void retrySessionRestore()}
                />
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

              {!restoreFailed && (provider === 'google' || provider === 'apple') ? (
                <Button
                  busy={busy}
                  disabled={busy}
                  icon={provider === 'google' ? 'login' : 'apple'}
                  label={t(provider === 'google' ? 'auth.continueGoogle' : 'auth.continueApple')}
                  onPress={() => void connectSocialAccount()}
                />
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
  heroPanel: {
    gap: spacing.xxl,
    backgroundColor: palette.ink,
    borderTopRightRadius: radius.xl,
    borderBottomLeftRadius: radius.xl,
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
    backgroundColor: palette.paperWarm,
    borderWidth: 1,
    borderColor: palette.primaryLight,
  },
  wordmark: {
    color: palette.paper,
    fontFamily: typography.brand,
    fontSize: 19,
    letterSpacing: 4.8,
  },
  heroBody: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.lg,
  },
  editorialSpine: {
    width: 28,
    alignItems: 'center',
    gap: spacing.md,
  },
  spineIndex: {
    color: palette.primarySoft,
    fontFamily: typography.mono,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  spineRule: {
    flex: 1,
    width: 2,
    minHeight: 48,
    backgroundColor: palette.primaryLight,
  },
  editorial: { flex: 1, minWidth: 0, gap: spacing.lg, paddingBottom: spacing.sm },
  index: {
    color: palette.primarySoft,
    fontFamily: typography.bold,
    fontSize: 10,
    letterSpacing: 1.35,
    textTransform: 'uppercase',
  },
  statement: {
    flexShrink: 1,
    color: palette.paper,
    fontFamily: typography.display,
    letterSpacing: -1.45,
  },
  introduction: {
    color: palette.surfaceDeep,
    fontFamily: typography.body,
    fontSize: 17,
    lineHeight: 26,
  },
  loading: { flex: 1, justifyContent: 'center' },
  accessPanel: {
    gap: spacing.lg,
    backgroundColor: palette.paper,
    borderLeftWidth: 4,
    borderLeftColor: palette.primary,
    borderTopWidth: 1,
    borderTopColor: palette.surfaceDeep,
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceDeep,
  },
  sheetTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  sheetToplineLargeText: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  sheetIndex: { color: palette.faint, fontFamily: typography.bold, fontSize: 10, letterSpacing: 1.4 },
  previewBadge: {
    flexShrink: 1,
    alignSelf: 'flex-start',
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
