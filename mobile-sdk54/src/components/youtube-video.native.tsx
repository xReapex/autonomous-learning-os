import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, Text, View } from 'react-native';
import YoutubePlayer, { type YoutubeIframeRef } from 'react-native-youtube-iframe';

import { palette, radius, spacing, typography } from '@/constants/theme';
import { createWatchEvidence, sampleWatchEvidence } from '@/lib/watch-evidence';
import { youtubeEmbedOrigin } from '@/lib/youtube-player-config';
import { decideYouTubeNavigation } from '@/lib/youtube-navigation-policy';

import { Button } from './ui';

import type { YouTubeVideoProps } from './youtube-video.types';

export function YouTubeVideo({ video, openLabel, requiredWatchSeconds, onQualified }: YouTubeVideoProps) {
  const [playing, setPlaying] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [screenFocused, setScreenFocused] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const playerRef = useRef<YoutubeIframeRef | null>(null);
  const videoKey = `${video.language}:${video.youtubeId}`;
  const evidence = useRef(createWatchEvidence(videoKey));
  const qualifiedCallback = useRef(onQualified);
  const handleNavigation = useCallback((request: { mainDocumentURL?: string; url: string }) => {
    const decision = decideYouTubeNavigation(request.mainDocumentURL || request.url, youtubeEmbedOrigin);
    if (decision === 'external') void Linking.openURL(request.mainDocumentURL || request.url);
    return decision === 'allow';
  }, []);

  useEffect(() => {
    qualifiedCallback.current = onQualified;
  }, [onQualified]);

  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, []),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const active = state === 'active';
      setAppActive(active);
      if (!active) setPlaying(false);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!playing || !appActive || !screenFocused || evidence.current.qualified) return;
    let cancelled = false;
    let sampling = false;
    const sample = async () => {
      if (sampling || !playerRef.current) return;
      sampling = true;
      try {
        const positionSeconds = await playerRef.current.getCurrentTime();
        if (cancelled || evidence.current.key !== videoKey) return;
        const next = sampleWatchEvidence(evidence.current, {
          positionSeconds,
          playing,
          visible: appActive && screenFocused,
          requiredSeconds: requiredWatchSeconds,
        });
        const becameQualified = !evidence.current.qualified && next.qualified;
        evidence.current = next;
        if (becameQualified) qualifiedCallback.current();
      } finally {
        sampling = false;
      }
    };
    void sample();
    const interval = setInterval(() => {
      void sample();
    }, 1_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [appActive, playing, requiredWatchSeconds, screenFocused, videoKey]);

  return (
    <View style={styles.container}>
      <View style={styles.player}>
        <YoutubePlayer
          baseUrlOverride={youtubeEmbedOrigin}
          ref={playerRef}
          height={210}
          initialPlayerParams={{ cc_lang_pref: video.language, hl: video.language }}
          onChangeState={(state: string) => setPlaying(state === 'playing')}
          onError={(error: string) => {
            setPlaying(false);
            setPlayerError(error);
          }}
          onReady={() => setPlayerError(null)}
          play={playing && appActive && screenFocused}
          useLocalHTML
          videoId={video.youtubeId}
          webViewProps={{
            accessible: true,
            accessibilityLabel: openLabel,
            originWhitelist: [youtubeEmbedOrigin, 'about:blank'],
            onShouldStartLoadWithRequest: handleNavigation,
          }}
        />
      </View>
      {playerError ? (
        <View accessibilityRole="alert" style={styles.errorBox}>
          <Text style={styles.errorText}>
            {video.language === 'fr'
              ? 'Le lecteur intégré est indisponible. Ouvrez la vidéo dans YouTube.'
              : 'The embedded player is unavailable. Open the video in YouTube.'}
          </Text>
          <Button
            label={openLabel}
            onPress={() => void Linking.openURL(video.url)}
            variant="secondary"
          />
        </View>
      ) : null}
      <Text style={styles.title}>{video.title}</Text>
      <Text style={styles.provider}>{video.provider}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  player: { overflow: 'hidden', borderRadius: radius.md, backgroundColor: palette.canvas },
  title: { color: palette.ink, fontFamily: typography.strong, fontSize: 16 },
  provider: { color: palette.muted, fontFamily: typography.body, fontSize: 14 },
  errorBox: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.warningLine,
    backgroundColor: palette.warningSoft,
  },
  errorText: { color: palette.ink, fontFamily: typography.body, fontSize: 14, lineHeight: 20 },
});
