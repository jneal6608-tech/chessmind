import { useEffect, useState } from 'react';
// Hash routing: works on any static host without rewrite rules.
export function useRoute(): string[] {
  const parse = () => (window.location.hash.replace(/^#\/?/, '') || 'dashboard').split('/').map(decodeURIComponent);
  const [r, setR] = useState(parse);
  useEffect(() => {
    const f = () => { setR(parse()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return r;
}
export const go = (path: string) => { window.location.hash = '/' + path; };
