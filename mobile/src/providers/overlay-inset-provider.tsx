import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

const OverlayInsetContext = createContext<{
  overlayInset: number;
  setOverlayInset: (value: number) => void;
} | null>(null);

export function OverlayInsetProvider({ children }: { children: ReactNode }) {
  const [overlayInset, setOverlayInset] = useState(0);
  const value = useMemo(() => ({ overlayInset, setOverlayInset }), [overlayInset]);
  return <OverlayInsetContext.Provider value={value}>{children}</OverlayInsetContext.Provider>;
}

export function useOverlayInset() {
  const value = useContext(OverlayInsetContext);
  if (!value) throw new Error('useOverlayInset must be used inside OverlayInsetProvider');
  return value;
}
