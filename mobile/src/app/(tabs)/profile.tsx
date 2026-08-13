import { AppIcon } from '@/components/app-icon';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  AppScreen,
  BentoGrid,
  BentoTile,
  Button,
  Metric,
  ProgressBar,
  Reveal,
  ScreenHeader,
  SectionTitle,
  StatusBanner,
  Surface,
  textStyles,
} from '@/components/ui';
import { layout, palette, radius, spacing, typography } from '@/constants/theme';
import { runAccountAction } from '@/lib/account-action';
import { requestDestructiveConfirmation } from '@/lib/destructive-confirmation';
import { haptics } from '@/lib/haptics';
import { milestoneDefinitions } from '@/lib/rewards';
import { publicScioUrl, type PublicScioPage } from '@/lib/public-links';
import { useFluidLayout } from '@/lib/use-fluid-layout';
import { useAuth } from '@/providers/auth-provider';
import { useLocale } from '@/providers/locale-provider';
import { useScioData } from '@/providers/data-provider';
import { useRewards } from '@/providers/rewards-provider';

export default function ProfileScreen() {
  const { locale, setLocale, t } = useLocale();
  const { deleteDevelopmentProfile, signOut, user } = useAuth();
  const { source } = useScioData();
  const { state: rewards } = useRewards();
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState(false);
  const level = Math.floor(rewards.xp / 100) + 1;
  const nextMilestone = milestoneDefinitions.find(({ xp }) => xp > rewards.xp);
  const fluid = useFluidLayout();

  const performAccountAction = async (action: () => Promise<void>) => {
    setAccountBusy(true);
    setAccountError(false);
    try {
      if (await runAccountAction(action) === 'error') setAccountError(true);
    } finally {
      setAccountBusy(false);
    }
  };

  const confirmSignOut = () => {
    requestDestructiveConfirmation({
      platform: Platform.OS === 'web' ? 'web' : 'native',
      title: t('profile.signOutConfirmTitle'),
      body: t('profile.signOutConfirmBody'),
      cancelLabel: t('common.cancel'),
      confirmLabel: t('profile.signOut'),
      action: () => void performAccountAction(signOut),
      webConfirm: (message) => typeof globalThis.confirm === 'function' && globalThis.confirm(message),
      nativeAlert: (title, body, buttons) => Alert.alert(title, body, buttons),
    });
  };

  const confirmDeleteProfile = () => {
    requestDestructiveConfirmation({
      platform: Platform.OS === 'web' ? 'web' : 'native',
      title: t('profile.deleteProfileConfirmTitle'),
      body: t('profile.deleteProfileConfirmBody'),
      cancelLabel: t('common.cancel'),
      confirmLabel: t('profile.deleteProfile'),
      action: () => void performAccountAction(deleteDevelopmentProfile),
      webConfirm: (message) => typeof globalThis.confirm === 'function' && globalThis.confirm(message),
      nativeAlert: (title, body, buttons) => Alert.alert(title, body, buttons),
    });
  };

  const openPublicPage = (page: PublicScioPage) => {
    void Linking.openURL(publicScioUrl(page));
  };

  return (
    <AppScreen>
          <ScreenHeader
            eyebrow={t('profile.eyebrow')}
            title={t('profile.title')}
            subtitle={t('profile.subtitle')}
          />
          <StatusBanner />

          <Reveal style={styles.section}>
            <SectionTitle
              trailing={<Text style={styles.level}>{t('profile.level', { level })}</Text>}>
              {t('profile.progress')}
            </SectionTitle>
            <BentoGrid>
              <BentoTile>
                <Metric icon="award" value={`${rewards.xp}`} label={t('profile.totalXp')} />
              </BentoTile>
              <BentoTile>
                <Metric icon="chart" value={`${rewards.mastery}%`} label={t('profile.mastery')} />
              </BentoTile>
              <BentoTile span="wide" style={styles.progressTile}>
                <Metric icon="flame" value={`${rewards.streak.count}`} label={t('profile.streak')} />
                <ProgressBar
                  value={rewards.mastery}
                  accessibilityLabel={t('a11y.progress', { value: rewards.mastery })}
                />
                <Text style={textStyles.muted}>{t('profile.streakHint')}</Text>
              </BentoTile>
            </BentoGrid>
          </Reveal>

          <Reveal delay={80} style={styles.section}>
            <SectionTitle>{t('profile.milestones')}</SectionTitle>
            <Surface style={styles.milestones}>
              {milestoneDefinitions.map((milestone) => {
                const unlocked = rewards.unlockedMilestoneIds.includes(milestone.id);
                return (
                  <View
                    accessible
                    accessibilityLabel={`${t(milestone.nameKey)}, ${milestone.xp} XP, ${t(
                      unlocked ? 'profile.unlocked' : 'profile.locked',
                    )}`}
                    key={milestone.id}
                    style={styles.milestone}>
                    <View
                      style={[
                        styles.milestoneIcon,
                        { width: fluid.controlSize * 0.75, aspectRatio: 1 },
                        unlocked && styles.milestoneIconUnlocked,
                      ]}>
                      <AppIcon
                        name="trophy"
                        size={18}
                        color={unlocked ? palette.onPrimary : palette.faint}
                      />
                    </View>
                    <View style={styles.milestoneCopy}>
                      <Text style={styles.milestoneName}>{t(milestone.nameKey)}</Text>
                      <Text style={textStyles.muted}>{milestone.xp} XP</Text>
                    </View>
                    <Text style={[styles.milestoneStatus, unlocked && styles.unlocked]}>
                      {t(unlocked ? 'profile.unlocked' : 'profile.locked')}
                    </Text>
                  </View>
                );
              })}
              <Text style={textStyles.muted}>
                {nextMilestone
                  ? t('profile.nextMilestone', { count: nextMilestone.xp - rewards.xp })
                  : t('profile.allMilestones')}
              </Text>
            </Surface>
          </Reveal>

          <Reveal delay={160} style={styles.section}>
            <SectionTitle>{t('profile.settings')}</SectionTitle>
            <Surface style={styles.settings}>
              <View style={styles.settingHeading}>
                <View style={[styles.settingIcon, { width: fluid.controlSize * 0.8, aspectRatio: 1 }]}>
                  <AppIcon name="language" size={21} color={palette.primaryText} />
                </View>
                <View style={styles.settingCopy}>
                  <Text style={styles.settingTitle}>{t('profile.language')}</Text>
                  <Text style={textStyles.muted}>{t('profile.languageHint')}</Text>
                </View>
              </View>
              <View accessibilityRole="radiogroup" style={styles.languages}>
                {(['fr', 'en'] as const).map((language) => {
                  const selected = locale === language;
                  const label = t(language === 'fr' ? 'profile.french' : 'profile.english');
                  return (
                    <Pressable
                      accessibilityLabel={t('a11y.language', { language: label })}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      aria-checked={selected}
                      key={language}
                      onPress={() => {
                        haptics.selection();
                        void setLocale(language);
                      }}
                      style={({ pressed }) => [
                        styles.language,
                        selected && styles.languageSelected,
                        pressed && styles.pressed,
                      ]}>
                      <Text style={[styles.languageText, selected && styles.languageTextSelected]}>
                        {label}
                      </Text>
                      {selected ? (
                        <AppIcon name="check" size={18} color={palette.onPrimary} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.rule} />
              <View style={styles.dataSource}>
                <View style={[styles.settingIcon, { width: fluid.controlSize * 0.8, aspectRatio: 1 }]}>
                  <AppIcon name="cloud-check" size={21} color={palette.primaryText} />
                </View>
                <View style={styles.settingCopy}>
                  <Text style={styles.settingTitle}>{t('profile.dataSource')}</Text>
                  <Text style={textStyles.muted}>
                    {t(
                      source === 'api'
                        ? 'profile.apiSource'
                        : source === 'cache'
                          ? 'profile.cachedSource'
                          : 'profile.generatedSource',
                    )}
                  </Text>
                </View>
              </View>
            </Surface>
          </Reveal>

          <Reveal delay={240} style={styles.section}>
            <SectionTitle>{t('profile.account')}</SectionTitle>
            <Surface style={styles.sessionCard}>
              <View style={styles.dataSource}>
                <View style={[styles.settingIcon, { width: fluid.controlSize * 0.8, aspectRatio: 1 }]}>
                  <AppIcon
                    name="user"
                    size={21}
                    color={palette.primaryText}
                  />
                </View>
                <View style={styles.settingCopy}>
                  <Text style={styles.settingTitle}>
                    {user?.displayName ?? t('profile.sessionChecking')}
                  </Text>
                  <Text style={textStyles.muted}>{t('profile.developmentProfileHint')}</Text>
                </View>
              </View>
              <Button
                busy={accountBusy}
                disabled={accountBusy}
                icon="logout"
                label={t('profile.signOut')}
                onPress={confirmSignOut}
                variant="secondary"
              />
              <Button
                busy={accountBusy}
                disabled={accountBusy}
                icon="delete"
                label={t('profile.deleteProfile')}
                onPress={confirmDeleteProfile}
                variant="danger"
              />
              {accountError ? (
                <Text accessibilityRole="alert" style={styles.accountError}>
                  {t('profile.accountActionError')}
                </Text>
              ) : null}
              <Text style={styles.accountNotice}>{t('profile.productionAccountNote')}</Text>
            </Surface>
          </Reveal>
          <Reveal delay={260} style={styles.section}>
            <SectionTitle>{t('profile.information')}</SectionTitle>
            <Surface style={styles.sessionCard}>
              <Button icon="lock" label={t('profile.privacy')} onPress={() => openPublicPage('privacy')} variant="secondary" />
              <Button icon="book-open" label={t('profile.terms')} onPress={() => openPublicPage('terms')} variant="secondary" />
              <Button icon="info" label={t('profile.support')} onPress={() => openPublicPage('support')} variant="secondary" />
              <Button icon="delete" label={t('profile.deletionInfo')} onPress={() => openPublicPage('account-deletion')} variant="ghost" />
            </Surface>
          </Reveal>
          <Text style={styles.version}>{t('profile.version')}</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  level: {
    color: palette.primaryText,
    fontFamily: typography.bold,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  progressTile: { gap: spacing.md },
  milestones: { gap: spacing.md },
  milestone: { minHeight: layout.touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  milestoneIcon: {
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceRaised,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneIconUnlocked: { backgroundColor: palette.primary, borderColor: palette.primary },
  milestoneCopy: { flex: 1 },
  milestoneName: { color: palette.ink, fontFamily: typography.strong },
  milestoneStatus: { color: palette.faint, fontFamily: typography.bold, fontSize: 11 },
  unlocked: { color: palette.success },
  settings: { gap: spacing.lg },
  sessionCard: { gap: spacing.lg },
  settingHeading: { flexDirection: 'row', gap: spacing.md },
  settingIcon: {
    borderRadius: radius.sm,
    backgroundColor: palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingCopy: { flex: 1, gap: 2 },
  settingTitle: { color: palette.ink, fontFamily: typography.strong, fontSize: 16 },
  languages: { flexDirection: 'row', gap: spacing.sm },
  language: {
    flex: 1,
    minHeight: layout.touchTarget,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  languageSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  languageText: { color: palette.ink, fontFamily: typography.strong },
  languageTextSelected: { color: palette.onPrimary },
  pressed: { opacity: 0.76 },
  rule: { height: 1, backgroundColor: palette.line },
  dataSource: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  accountNotice: {
    color: palette.faint,
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 18,
  },
  accountError: {
    color: palette.danger,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19,
  },
  version: { color: palette.faint, fontFamily: typography.body, fontSize: 12, textAlign: 'center' },
});
