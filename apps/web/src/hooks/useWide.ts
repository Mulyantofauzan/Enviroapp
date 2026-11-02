import { useEffect, useState } from 'react';

const QUERY = '(min-width: 900px)';
const match = () => typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;

export function useWide(): boolean {
  const [wide, setWide] = useState(match);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const m = window.matchMedia(QUERY);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}
