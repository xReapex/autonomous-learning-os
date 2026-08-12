import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { elevation, layout, palette, radius, typography } from '@/constants/theme';
import { useFluidLayout } from '@/lib/use-fluid-layout';
import { useLocale } from '@/providers/locale-provider';

type TabIconProps = { color: ColorValue; focused: boolean; size: number };

export default function TabsLayout() {
  const { t } = useLocale();
  const fluid = useFluidLayout();
  const tabs = [
    { name: 'index', title: t('tabs.home'), icon: 'home' },
    { name: 'courses', title: t('tabs.courses'), icon: 'book-open' },
    { name: 'exercises', title: t('tabs.exercises'), icon: 'exercises' },
    { name: 'reviews', title: t('tabs.reviews'), icon: 'reviews' },
    { name: 'profile', title: t('tabs.profile'), icon: 'user' },
  ] as const;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: palette.canvas },
        tabBarActiveTintColor: palette.white,
        tabBarInactiveTintColor: palette.surfaceDeep,
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: !fluid.compact,
        tabBarLabelStyle: {
          fontFamily: typography.strong,
          fontSize: 10,
          marginTop: 2,
        },
        tabBarItemStyle: {
          minHeight: layout.touchTarget,
          margin: fluid.gutter * 0.2,
          borderRadius: radius.md,
          paddingTop: fluid.compact ? 0 : fluid.gutter * 0.2,
        },
        tabBarStyle: {
          position: 'absolute',
          left: fluid.gutter,
          right: fluid.gutter,
          bottom: fluid.gutter * 0.4,
          height: fluid.tabBarHeight,
          backgroundColor: palette.ink,
          borderColor: palette.inkSoft,
          borderTopColor: palette.inkSoft,
          borderWidth: 1,
          borderTopWidth: 1,
          borderRadius: radius.xl,
          paddingHorizontal: fluid.gutter * 0.2,
          ...elevation.floating,
        },
        tabBarActiveBackgroundColor: palette.primary,
      }}>
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: t('a11y.tab', { tab: tab.title }),
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
      ))}
    </Tabs>
  );
}
