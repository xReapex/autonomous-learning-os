import type { YouTubeVideoResource } from '@/types/scio';

export type YouTubeVideoProps = {
  video: YouTubeVideoResource;
  openLabel: string;
  requiredWatchSeconds: number;
  onQualified: () => void;
};
