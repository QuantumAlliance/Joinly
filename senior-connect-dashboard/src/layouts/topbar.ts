/**
 * Topbar configuration, published by whichever page is mounted.
 *
 * The frames use three topbar shapes, so pages declare which one they want
 * rather than the layout guessing from the route:
 *   search  title + search field + bell + avatar   (Dashboard, Users, details)
 *   action  title + a right-side button + avatar   (Categories)
 *   plain   title + avatar                         (Notifications)
 *
 * AdminLayout owns the provider; this module is hooks and types only so it can
 * be imported by pages without dragging a component across the boundary.
 */
import { createContext, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';

export interface TopbarConfig {
  title: string;
  variant?: 'search' | 'action' | 'plain';
  /** Renders the back chevron left of the title, as on the two detail screens. */
  backTo?: string;
  /** Right-hand control for the `action` variant. */
  action?: ReactNode;
}

export const DEFAULT_TOPBAR: TopbarConfig = { title: 'Dashboard', variant: 'search' };

export const TopbarContext = createContext<{
  config: TopbarConfig;
  setConfig: (config: TopbarConfig) => void;
}>({ config: DEFAULT_TOPBAR, setConfig: () => {} });

export function useTopbarConfig() {
  return useContext(TopbarContext).config;
}

/**
 * Declare this page's topbar. `deps` covers anything interpolated into the
 * config (an action button's handler, a dynamic title) so it re-publishes.
 */
export function useTopbar(config: TopbarConfig, deps: unknown[] = []) {
  const { setConfig } = useContext(TopbarContext);
  const { title, variant, backTo, action } = config;
  useEffect(() => {
    setConfig({ title, variant, backTo, action });
    // `action` is a fresh element on every render, so it is deliberately left
    // out of the dependency list in favour of the caller-supplied `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, variant, backTo, setConfig, ...deps]);
}
