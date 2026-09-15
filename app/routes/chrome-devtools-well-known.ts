/** Chrome DevTools probes this URL; return empty JSON so the router doesn't log 404 noise. */
export async function loader() {
  return new Response("{}", {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
