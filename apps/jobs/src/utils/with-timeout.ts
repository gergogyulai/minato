export function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  let id: ReturnType<typeof setTimeout>;
  const timer = new Promise<never>((_, reject) => {
    id = setTimeout(() => reject(new Error(`Job timed out after ${ms}ms`)), ms);
  });
  return Promise.race([fn(), timer]).finally(() => clearTimeout(id));
}
