export interface MetadataProvider<T> {
  readonly name: string;
  readonly supportedTypes: ("movie" | "tv" | "anime")[];

  find(title: string, year?: number, type?: string): Promise<T | null>;

  getAssetUrl?(
    path: string,
    type: "poster" | "backdrop",
  ): string;
}
