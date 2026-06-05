export async function sendTelegram(
	config: { botToken: string; chatId: string },
	title: string,
	body: string,
): Promise<void> {
	const text = `<b>${title}</b>\n${body}`;
	const res = await fetch(
		`https://api.telegram.org/bot${config.botToken}/sendMessage`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ chat_id: config.chatId, text, parse_mode: "HTML" }),
		},
	);
	if (!res.ok) {
		const detail = await res.text().catch(() => "");
		throw new Error(`Telegram API error ${res.status}: ${detail}`);
	}
}
