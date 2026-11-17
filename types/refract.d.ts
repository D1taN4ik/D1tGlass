export interface RefractOptions {
  /** Refraction strength. Default: 50 */
  scale?: number;
  /** Width of the curved edge zone in px. Default: 20 */
  bezel?: number;
  /** RGB channel split, 0 disables it. Default: 0.08 */
  aberration?: number;
  /** Extra blur in px. Default: 0.6 */
  blur?: number;
  /** Saturation in %. Default: 170 */
  saturate?: number;
  /** Brightness multiplier. Default: 1.06 */
  brightness?: number;
}

export type RefractTarget = Element | NodeListOf<Element> | Element[] | string;

export interface RefractTabs {
  readonly index: number;
  select(index: number): void;
  layout(): void;
  readonly element: Element;
}

export interface RefractChangeDetail {
  index: number;
  tab: Element;
  previous: number;
}

export interface RefractStatic {
  readonly version: string;
  readonly supported: boolean;
  readonly defaults: Readonly<Required<RefractOptions>>;
  init(): void;
  apply(target: RefractTarget, options?: RefractOptions): void;
  remove(target: RefractTarget): void;
  refresh(target?: RefractTarget): void;
  tabs(container: Element): RefractTabs;
  haptic(ms?: number): void;
}

declare const Refract: RefractStatic;
export default Refract;

declare global {
  interface Window {
    Refract: RefractStatic;
  }
  interface HTMLElementEventMap {
    "rf:change": CustomEvent<RefractChangeDetail>;
  }
}
