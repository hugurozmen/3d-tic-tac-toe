import { createContext, useContext } from 'react';
import type { ReactNode, RefObject } from 'react';

const STATIC_CUBE_PROGRESS: RefObject<number> = { current: 0 };
const LayoutMorphContext = createContext<RefObject<number>>(
  STATIC_CUBE_PROGRESS,
);

export function LayoutMorphProvider({
  children,
  progress,
}: {
  children: ReactNode;
  progress: RefObject<number>;
}) {
  return (
    <LayoutMorphContext.Provider value={progress}>
      {children}
    </LayoutMorphContext.Provider>
  );
}

export const useLayoutMorphProgress = () => useContext(LayoutMorphContext);
