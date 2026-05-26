export function mergeConfig<TConfig>(
  defaults: TConfig | undefined,
  serverConfig: Record<string, unknown>,
): TConfig {
  return { ...(defaults ?? {}), ...serverConfig } as TConfig;
}
