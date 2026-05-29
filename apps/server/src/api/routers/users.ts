import { ORPCError } from "@orpc/server";
import { auth } from "@project-minato/auth";
import { db, desc, user } from "@project-minato/db";
import { z } from "zod";
import { adminProcedure } from "@/api";

const userDto = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
	emailVerified: z.boolean(),
	image: z.string().nullable(),
	role: z.string().nullable(),
	banned: z.boolean().nullable(),
	banReason: z.string().nullable(),
	banExpires: z.date().nullable(),
	createdAt: z.date(),
});

export const usersRouter = {
	list: adminProcedure
		.route({
			method: "GET",
			path: "/users",
			summary: "List all user accounts",
			tags: ["users"],
		})
		.output(z.object({ users: z.array(userDto) }))
		.handler(async () => {
			const rows = await db
				.select({
					id: user.id,
					name: user.name,
					email: user.email,
					emailVerified: user.emailVerified,
					image: user.image,
					role: user.role,
					banned: user.banned,
					banReason: user.banReason,
					banExpires: user.banExpires,
					createdAt: user.createdAt,
				})
				.from(user)
				.orderBy(desc(user.createdAt));

			return { users: rows };
		}),

	setRole: adminProcedure
		.route({
			method: "POST",
			path: "/users/role",
			summary: "Change a user's role",
			tags: ["users"],
		})
		.input(z.object({ userId: z.string(), role: z.enum(["admin", "user"]) }))
		.output(z.object({ success: z.boolean() }))
		.handler(async ({ input, context }) => {
			// Guard against an admin locking themselves out of the panel.
			if (
				input.userId === context.session?.user?.id &&
				input.role !== "admin"
			) {
				throw new ORPCError("BAD_REQUEST", {
					message: "You cannot remove your own admin role.",
				});
			}

			await auth.api.setRole({
				body: { userId: input.userId, role: input.role },
				headers: context.honoContext.req.raw.headers,
			});

			return { success: true };
		}),

	setBanned: adminProcedure
		.route({
			method: "POST",
			path: "/users/ban",
			summary: "Ban or unban a user",
			tags: ["users"],
		})
		.input(
			z.object({
				userId: z.string(),
				banned: z.boolean(),
				reason: z.string().optional(),
			}),
		)
		.output(z.object({ success: z.boolean() }))
		.handler(async ({ input, context }) => {
			if (input.userId === context.session?.user?.id) {
				throw new ORPCError("BAD_REQUEST", {
					message: "You cannot ban your own account.",
				});
			}

			if (input.banned) {
				await auth.api.banUser({
					body: { userId: input.userId, banReason: input.reason },
					headers: context.honoContext.req.raw.headers,
				});
			} else {
				await auth.api.unbanUser({
					body: { userId: input.userId },
					headers: context.honoContext.req.raw.headers,
				});
			}

			return { success: true };
		}),
};
