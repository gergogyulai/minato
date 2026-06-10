import { Hono } from "hono";
import { XMLParser } from "fast-xml-parser";

const REAL_PROWLARR_URL = process.env.PROWLARR_URL || "http://localhost:9696/";

const xmlParser = new XMLParser({ 
  ignoreAttributes: false, 
  attributeNamePrefix: "@_" 
});

export const proxy = new Hono();

proxy.all("/prowlarr/*", async (c) => {
  try {
    const url = new URL(c.req.url);
    // Strip the "/prowlarr" prefix to cleanly rebuild the true Prowlarr destination URL
    const targetPath = url.pathname.replace(/^\/api\/v1\/proxy\/prowlarr/, "");
    const targetUrl = `${REAL_PROWLARR_URL}${targetPath}${url.search}`;

    const proxyHeaders = new Headers(c.req.header());
    proxyHeaders.set("host", new URL(REAL_PROWLARR_URL).host);

    const proxyResponse = await fetch(targetUrl, {
      method: c.req.method,
      headers: proxyHeaders,
      body: ["GET", "HEAD"].includes(c.req.method) ? undefined : await c.req.arrayBuffer()
    });

    const responseText = await proxyResponse.text();

    const queryType = url.searchParams.get("t");
    if (queryType && queryType !== "caps") {
      processXmlPayloadInBackground(responseText).catch((err) => {
        console.error("[minato-proxy] Background execution failed:", err);
      });
    }

    return c.text(responseText, proxyResponse.status as any, {
      "Content-Type": proxyResponse.headers.get("content-type") || "application/xml"
    });

  } catch (error) {
    console.error("[minato-proxy] Connection link disrupted:", error);
    return c.text("Minato Proxy Link Error", 500);
  }
});


async function processXmlPayloadInBackground(xmlText: string) {
  if (!xmlText.includes("<rss")) return;

  const parsed = xmlParser.parse(xmlText);
  const items = parsed?.rss?.channel?.item;
  const normalizedItems = Array.isArray(items) ? items : items ? [items] : [];

  for (const item of normalizedItems) {
    const title = item.title;
    const torznabAttrs = item["torznab:attr"] || [];
    const normalizedAttrs = Array.isArray(torznabAttrs) ? torznabAttrs : [torznabAttrs];
    
    let infoHash = "";

    for (const attr of normalizedAttrs) {
      if (attr["@_name"] === "infohash") {
        infoHash = attr["@_value"];
        break;
      }
    }

    if (infoHash && title) {
      console.log(`[minato-proxy] Sniffed & Logged: ${title} [${infoHash}]`);
    }
  }
}