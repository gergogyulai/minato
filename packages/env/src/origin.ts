const parseForwardedValue = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const first = value.split(",")[0]?.trim();
  return first || null;
};

const sanitizeProtocol = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase().replace(/:$/, "");
  return normalized === "http" || normalized === "https" ? normalized : null;
};

export const inferOriginFromRequest = (request: Request): string | null => {
  const forwardedHost = parseForwardedValue(request.headers.get("x-forwarded-host"));
  const host = forwardedHost ?? parseForwardedValue(request.headers.get("host"));
  if (!host) {
    return null;
  }

  const forwardedProto = sanitizeProtocol(
    parseForwardedValue(request.headers.get("x-forwarded-proto")),
  );
  const requestProto = sanitizeProtocol(new URL(request.url).protocol);
  const protocol = forwardedProto ?? requestProto;

  if (!protocol) {
    return null;
  }

  return `${protocol}://${host}`;
};
