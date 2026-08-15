import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon, type AppIconName } from '@/components/app-icon';
import { layout, palette, typography } from '@/constants/theme';
import type { TranslationKey } from '@/lib/i18n';
import { useFluidLayout } from '@/lib/use-fluid-layout';
import { useLocale } from '@/providers/locale-provider';

type TabIconProps = { color: ColorValue; focused: boolean; size: number };
type TabConfig = {
  icon: AppIconName;
  name: 'index' | 'courses' | 'exercises' | 'reviews' | 'profile';
  shortTitleKey?: TranslationKey;
  titleKey: TranslationKey;
};

export default function TabsLayout() {
  const { t } = useLocale();
  const fluid = useFluidLayout();
  const insets = useSafeAreaInsets();
  const tabs: readonly TabConfig[] = [
    { name: 'index', titleKey: 'tabs.home', shortTitleKey: 'tabs.homeShort', icon: 'home' },
    { name: 'courses', titleKey: 'tabs.courses', icon: 'book-open' },
    { name: 'exercises', titleKey: 'tabs.exercises', shortTitleKey: 'tabs.exercisesShort', icon: 'exercises' },
    { name: 'reviews', titleKey: 'tabs.reviews', shortTitleKey: 'tabs.reviewsShort', icon: 'reviews' },
    { name: 'profile', titleKey: 'tabs.profile', icon: 'user' },
  ];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: palette.canvas },
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.muted,
        tabBarHideOnKeyboard: true,
        tabBarLabelPosition: 'below-icon',
        tabBarPosition: fluid.tablet ? 'left' : 'bottom',
        tabBarShowLabel: true,
        tabBarVariant: fluid.tablet ? 'material' : 'uikit',
        tabBarLabelStyle: {
          fontFamily: typography.strong,
          fontSize: 10,
          marginTop: 0,
        },
        tabBarItemStyle: {
          minHeight: layout.touchTarget,
          paddingTop: fluid.compact ? 2 : 6,
          paddingBottom: 4,
        },
        tabBarStyle: {
          backgroundColor: palette.paper,
          ...(fluid.tablet
            ? {
                width: fluid.tabBarWidth,
                borderRightColor: palette.surfaceDeep,
                borderRightWidth: 1,
                borderTopWidth: 0,
                paddingTop: insets.top,
                paddingBottom: insets.bottom,
              }
            : {
                height: fluid.tabBarHeight + insets.bottom,
                borderTopColor: palette.surfaceDeep,
                borderTopWidth: 1,
                paddingBottom: insets.bottom,
              }),
          paddingHorizontal: fluid.gutter * 0.2,
        },
      }}>
      {tabs.map((tab) => {
        const fullTitle = t(tab.titleKey);
        const visualTitle = t(fluid.largeText && tab.shortTitleKey ? tab.shortTitleKey : tab.titleKey);
        const accessibilityTitle = fluid.largeText && tab.shortTitleKey
          ? t('a11y.tabWithShort', { short: visualTitle, tab: fullTitle })
          : t('a11y.tab', { tab: fullTitle });
        return (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: visualTitle,
              tabBarAccessibilityLabel: accessibilityTitle,
              tabBarIcon: ({ color, focused, size }: TabIconProps) => (
                <AppIcon
                  name={tab.icon}
                  color={color}
                  size={size}
                  strokeWidth={focused ? 2.4 : 1.8}
                />
              ),
            }}
          />
        );
      })}
    </Tabs>
  );
}
