export type FluidLayout = {
  compact: boolean;
  largeText: boolean;
  shortViewport: boolean;
  tablet: boolean;
  contentWidth: `${number}%`;
  gutter: number;
  sectionGap: number;
  cardPadding: number;
  controlSize: number;
  titleSize: number;
  titleLineHeight: number;
  tabBarHeight: number;
  tabBarWidth: number;
};

const between = (minimum: number, value: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function resolveFluidLayout(width: number, height: number, fontScale: number): FluidLayout {
  const shortestSide = Math.max(1, Math.min(width, height));
  const compact = shortestSide < 360 || fontScale >= 1.3;
  const tablet = width >= 600;
  const gutter = shortestSide * (tablet ? 0.055 : 0.047);
  const controlSize = Math.max(48, shortestSide * 0.12);
  const titleSize = between(30, shortestSide * 0.097, tablet ? 52 : 42);

  return {
    compact,
    largeText: fontScale >= 1.3,
    shortViewport: height < 620,
    tablet,
    contentWidth: `${tablet ? 78 : 100}%`,
    gutter,
    sectionGap: shortestSide * (compact ? 0.052 : 0.068),
    cardPadding: shortestSide * (compact ? 0.047 : 0.061),
    controlSize,
    titleSize,
    titleLineHeight: titleSize * 1.12,
    tabBarHeight: controlSize * (fontScale >= 1.3 ? 1.55 : 1.38),
    tabBarWidth: between(88, controlSize * 1.7, 120),
  };
}
