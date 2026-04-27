// Vercel Edge Middleware: runs at the CDN edge on every request
// Handles:
//   1. Accept: text/markdown → serve llms.txt as markdown CV for AI agents
//   2. Adds RFC 8288 Link headers for agent discovery
//   3. Adds Content-Signal header declaring AI usage preferences

export const config = {
  matcher: ["/", "/index.html"],
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const acceptHeader = request.headers.get("Accept") || "";
  const wantsMarkdown = acceptHeader.includes("text/markdown");

  const linkHeader = [
    '</llms.txt>; rel="describedby"; type="text/plain"',
    '</sitemap.xml>; rel="sitemap"; type="application/xml"',
    '</andrii_taran_cv.pdf>; rel="alternate"; type="application/pdf"; title="CV PDF"',
    '<https://linkedin.com/in/nomadmao>; rel="me"',
    '</.well-known/api-catalog>; rel="api-catalog"',
  ].join(", ");

  const contentSignal = "search=yes, ai-train=no, ai-input=yes";

  // ── Markdown negotiation ──────────────────────────────────────────────────
  // Agent sends Accept: text/markdown → return llms.txt with correct headers
  if (wantsMarkdown) {
    const llmsUrl = new URL("/llms.txt", url.origin);

    try {
      const llmsResponse = await fetch(llmsUrl);

      if (llmsResponse.ok) {
        const markdown = await llmsResponse.text();

        // Token estimate: ~1 token per 4 characters (GPT-style approximation)
        const tokenEstimate = Math.ceil(markdown.length / 4);

        return new Response(markdown, {
          status: 200,
          headers: {
            "Content-Type":      "text/markdown; charset=utf-8",
            "Vary":              "Accept",
            "x-markdown-tokens": String(tokenEstimate),
            "Link":              linkHeader,
            "Content-Signal":    contentSignal,
            "Cache-Control":     "public, max-age=3600",
          },
        });
      }
    } catch (e) {
      // llms.txt fetch failed — fall through to normal HTML response
    }
  }

  // ── Normal HTML response — pass through + inject headers ─────────────────
  const response = await fetch(request);
  const newHeaders = new Headers(response.headers);

  newHeaders.set("Vary",           "Accept");
  newHeaders.set("Link",           linkHeader);
  newHeaders.set("Content-Signal", contentSignal);

  return new Response(response.body, {
    status:     response.status,
    statusText: response.statusText,
    headers:    newHeaders,
  });
}