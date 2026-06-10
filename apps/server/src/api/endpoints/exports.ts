import path from "node:path";
import { auth } from "@project-minato/auth";
import { exportsDir } from "@project-minato/env/paths";
import type { Context } from "hono";

export async function handleExports(c: Context): Promise<Response> {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session?.user) return c.text("Unauthorized", 401);
	if ((session.user as { role?: string }).role !== "admin")
		return c.text("Forbidden", 403);

	const filename = c.req.param("filename");
	if (!filename || !/^[a-zA-Z0-9_-]+\.sqlite$/.test(filename))
		return c.text("Invalid filename", 400);

	const file = Bun.file(path.join(exportsDir, filename));
	if (!(await file.exists())) return c.text("Not Found", 404);

	return new Response(file, {
		headers: {
			"Content-Type": "application/x-sqlite3",
			"Content-Disposition": `attachment; filename="${filename}"`,
			"Content-Length": String(file.size),
		},
	});
}
