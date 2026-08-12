import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { layout, palette, typography } from '@/constants/theme';
import { useFluidLayout } from '@/lib/use-fluid-layout';
import { useLocale } from '@/providers/locale-provider';

type TabIconProps = { color: ColorValue; focused: boolean; size: number };

export default function TabsLayout() {
  const { t } = useLocale();
  const fluid = useFluidLayout();
  const insets = useSafeAreaInsets();
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
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.muted,
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: !fluid.compact,
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
          height: fluid.tabBarHeight + insets.bottom,
          backgroundColor: palette.paper,
          borderTopColor: palette.surfaceDeep,
          borderTopWidth: 1,
          paddingBottom: insets.bottom,
          paddingHorizontal: fluid.gutter * 0.2,
        },
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
