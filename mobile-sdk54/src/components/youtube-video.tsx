import { AppIcon } from './app-icon';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { layout, palette, radius, spacing, typography } from '@/constants/theme';

import type { YouTubeVideoProps } from './youtube-video.types';

export function YouTubeVideo({ video, openLabel }: YouTubeVideoProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{video.title}</Text>
      <Text style={styles.provider}>{video.provider}</Text>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={openLabel}
        onPress={() => void Linking.openURL(video.url)}
        style={styles.button}>
        <AppIcon name="youtube" size={24} color={palette.white} />
        <Text style={styles.buttonText}>{openLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  title: { color: palette.ink, fontFamily: typography.strong, fontSize: 16 },
  provider: { color: palette.muted, fontFamily: typography.body, fontSize: 14 },
  button: {
    minHeight: layout.touchTarget,
    borderRadius: radius.md,
    backgroundColor: palette.primary,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonText: { color: palette.onPrimary, fontFamily: typography.strong, fontSize: 16 },
});
