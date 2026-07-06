import { useEffect, useState } from 'react';

export function useLocalStorageState<T extends string>(
  key: string,
  defaultValue: T,
  allowedValues: readonly T[],
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);

      if (stored !== null && (allowedValues as readonly string[]).includes(stored)) {
        return stored as T;
      }
    } catch {
      // localStorage can be unavailable (privacy mode); fall through to default
    }

    return defaultValue;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // best-effort persistence only
    }
  }, [key, value]);

  return [value, setValue] as const;
}
