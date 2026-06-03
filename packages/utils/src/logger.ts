import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
	level: "info",
	...(isDev && {
		transport: {
			target: "pino-pretty",
			options: {
				colorize: true,
				translateTime: "SYS:HH:MM:ss",
				ignore: "pid,hostname",
			},
		},
	}),
});
