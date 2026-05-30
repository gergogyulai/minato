export interface MapperContext {
	infoHash: string;
	providerName: string;
	posterUrl: string | null;
	backdropUrl: string | null;
	episodeNumber?: string | number | null;
	seasonNumber?: string | number | null;
}
