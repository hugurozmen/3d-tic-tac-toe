import { useEffect, useState } from 'react';

export function usePanelDisclosure(key: string, defaultOpen: boolean) {
  const [open, setOpen] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);

      if (stored === 'open') {
        return true;
      }

      if (stored === 'closed') {
        return false;
      }
    } catch {
      return defaultOpen;
    }

    return defaultOpen;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, open ? 'open' : 'closed');
    } catch {
      // Disclosure state is a convenience only.
    }
  }, [key, open]);

  return [open, setOpen] as const;
}
