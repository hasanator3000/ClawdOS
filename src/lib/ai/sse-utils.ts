/**
 * Shared SSE (Server-Sent Events) utilities for fast-path responses.
 */

export function sseResponse(body: ReadableStream): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
