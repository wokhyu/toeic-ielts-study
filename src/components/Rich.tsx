import { otMediaBase } from '../lib/supabase.ts';

/** Renders question HTML produced by the on-tap-11 pipeline; images point at the Storage bucket. */
export function Rich({ html, className = '' }: { html: string; className?: string }) {
  const fixed = html.replaceAll('src="/media/', `src="${otMediaBase}`);
  return <span className={`rich ${className}`} dangerouslySetInnerHTML={{ __html: fixed }} />;
}
