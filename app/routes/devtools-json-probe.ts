/** Chrome and Cursor probe these URLs on the dev server. A matched 404 avoids the router error log. */
export function loader() {
  return new Response(null, { status: 404 });
}
