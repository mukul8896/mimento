/**
 * Product analytics port — Phase 2 (Umami). Events must never carry share tokens, voucher
 * values, message bodies or recipient answers. No Phase 1 implementation.
 */
export interface AnalyticsSink {
  track(event: {
    name: string;
    properties: Record<string, string | number | boolean>;
  }): Promise<void>;
}
