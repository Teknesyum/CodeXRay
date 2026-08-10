import { invoke } from '@tauri-apps/api/core';
import { isDesktopRuntime } from './desktopAiService';

export const installDesktopExternalLinkHandler = (): (() => void) => {
  if (!isDesktopRuntime()) return () => undefined;

  const onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest('a[href]');
    if (!(anchor instanceof HTMLAnchorElement)) return;
    const url = new URL(anchor.href, window.location.href);
    if (url.origin === window.location.origin) return;
    event.preventDefault();
    void invoke('open_external_url', { url: url.toString() });
  };

  document.addEventListener('click', onClick);
  return () => document.removeEventListener('click', onClick);
};
