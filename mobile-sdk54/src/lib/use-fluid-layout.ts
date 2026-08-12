import { useWindowDimensions } from 'react-native';

import { resolveFluidLayout, type FluidLayout } from './fluid-layout';

export function useFluidLayout(): FluidLayout {
  const { width, height, fontScale } = useWindowDimensions();
  return resolveFluidLayout(width, height, fontScale);
}