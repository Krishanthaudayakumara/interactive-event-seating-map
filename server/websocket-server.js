const WebSocket = require('ws');

const PORT = 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log(`WebSocket server running on ws://localhost:${PORT}`);

const seats = [];
for (let i = 1; i <= 100; i++) {
  seats.push({ id: `A-1-${i}`, status: 'available' });
}

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connected' }));
  
  const interval = setInterval(() => {
    const randomSeat = seats[Math.floor(Math.random() * seats.length)];
    const statuses = ['available', 'reserved', 'sold', 'held'];
    const newStatus = statuses[Math.floor(Math.random() * statuses.length)];
    
    randomSeat.status = newStatus;
    
    const update = {
      type: 'seat-update',
      seatId: randomSeat.id,
      status: newStatus,
      timestamp: Date.now()
    };
    
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(update));
      }
    });
    
    console.log(`Seat ${randomSeat.id} -> ${newStatus}`);
  }, 3000);
  
  ws.on('close', () => {
    console.log('Client disconnected');
    clearInterval(interval);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

wss.on('error', (error) => {
  console.error('Server error:', error);
});
