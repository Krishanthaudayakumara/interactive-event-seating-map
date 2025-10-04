// WebSocket endpoint for live seat status updates
// Note: Next.js API routes don't support WebSockets natively
// This is a placeholder - for production use, deploy a separate WebSocket server
// or use a service like Pusher, Ably, or Socket.io

export async function GET() {
  return new Response('WebSocket server not available in Next.js API routes. Use a separate server or service like Pusher/Ably.', {
    status: 501,
  });
}
