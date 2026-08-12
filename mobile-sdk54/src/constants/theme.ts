import { Platform } from 'react-native';

export { palette } from './palette';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  hero: 48,
} as const;

export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 26,
  pill: 999,
} as const;

// Custom font families are loaded in src/app/_layout.tsx via expo-font.
// Each family maps to a single weight file so styles never rely on fontWeight synthesis.
export const typography = {
  brand: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
  display: 'SpaceGrotesk-Bold',
  title: 'SpaceGrotesk-SemiBold',
  heading: 'SpaceGrotesk-Medium',
  body: 'Inter-Regular',
  medium: 'Inter-Medium',
  strong: 'Inter-SemiBold',
  bold: 'Inter-Bold',
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
} as const;

export const layout = {
  maxWidth: 720,
  touchTarget: 48,
  tabBarHeight: 72,
  screenGutter: 20,
} as const;

export const elevation = {
  soft: {
    shadowColor: '#10231F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 3,
  },
  floating: {
    shadowColor: '#10231F',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.13,
    shadowRadius: 28,
    elevation: 8,
  },
} as const;
