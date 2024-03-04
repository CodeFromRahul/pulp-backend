
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);


// Socket.io logic
const rooms = {};

io.on('connection', (socket) => {
    // Handle room creation by host
    socket.on('createRoom', () => {
        const roomId = generateUniqueRoomId();
        socket.join(roomId);
        rooms[roomId] = {
            host: socket.id,
            clients: [],
        };
        socket.emit('roomCreated', { roomId });
    });

    // Handle client joining a room
    socket.on('joinRoom', (roomId) => {
        if (rooms[roomId]) {
            socket.join(roomId);
            rooms[roomId].clients.push(socket.id);
            io.to(rooms[roomId].host).emit('clientJoined', { clientId: socket.id });
            socket.emit('roomJoined', { roomId });
        } else {
            socket.emit('roomNotFound');
        }
    });

    // Handle chat messages
    socket.on('message', (data) => {
        io.to(data.roomId).emit('message', {
            sender: socket.id,
            message: data.message,
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        // Check if the disconnected user is a host
        const roomId = getRoomIdBySocketId(socket.id);
        if (roomId) {
            if (rooms[roomId].host === socket.id) {
                // If the host disconnects, inform clients and remove the room
                rooms[roomId].clients.forEach((client) => {
                    io.to(client).emit('hostDisconnected');
                });
                delete rooms[roomId];
            } else {
                // If a client disconnects, remove them from the room
                const index = rooms[roomId].clients.indexOf(socket.id);
                if (index !== -1) {
                    rooms[roomId].clients.splice(index, 1);
                    io.to(rooms[roomId].host).emit('clientLeft', { clientId: socket.id });
                }
            }
        }
    });
});

// Helper functions
function generateUniqueRoomId() {
    let roomId;
    do {
        roomId = uuidv4().substr(0, 5).toUpperCase();
    } while (rooms[roomId]);
    return roomId;
}

function getRoomIdBySocketId(socketId) {
    for (const roomId in rooms) {
        if (rooms[roomId].host === socketId || rooms[roomId].clients.includes(socketId)) {
            return roomId;
        }
    }
    return null;
}


// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
