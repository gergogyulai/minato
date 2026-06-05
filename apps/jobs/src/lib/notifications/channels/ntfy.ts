export async function sendNtfy(
	config: { url: string; topic: string; token?: string },
	title: string,
	body: string,
): Promise<void> {
	const url = `${config.url.replace(/\/$/, "")}/${config.topic}`;
	const headers: Record<string, string> = {
		Title: title,
		Priority: "3",
		"Content-Type": "text/plain",
	};
	if (config.token) headers.Authorization = `Bearer ${config.token}`;
	const res = await fetch(url, { method: "POST", headers, body });
	if (!res.ok) {
		const detail = await res.text().catch(() => "");
		throw new Error(`ntfy error ${res.status}: ${detail}`);
	}
}
