// Types for jarvis-core.js (the engine is plain JavaScript, identical in every company repo).
export interface JarvisCompany {
  id: string;
  name: string;
  repo: string;
  context: string;
  accessCodeFallback?: (env: Record<string, string | undefined>) => string;
}
export interface JarvisConfig {
  mode: "company" | "master";
  [key: string]: unknown;
}
export interface JarvisRequest {
  method: string;
  headers: Headers | Record<string, string | string[] | undefined>;
  body?: unknown;
}
export interface JarvisResponse {
  status: number;
  body: Record<string, unknown>;
}
export function companyConfig(env: Record<string, string | undefined>, company: JarvisCompany): JarvisConfig;
export function masterConfig(
  env: Record<string, string | undefined>,
  holding: JarvisCompany,
  companies: JarvisCompany[],
): JarvisConfig;
export function stripeEnvName(id: string): string;
export function handleJarvis(req: JarvisRequest, config: JarvisConfig): Promise<JarvisResponse>;
