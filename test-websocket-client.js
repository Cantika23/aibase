#!/usr/bin/env node

// Simple test client to verify multiple WebSocket connections per conversation

const WebSocket = require('ws');

const CONV_ID = 'test-conv-' + Date.now();
const NUM_CONNECTIONS = 3;

console.log(`Testing ${NUM_CONNECTIONS} connections for conversation ID: ${CONV_ID}`);

const connections = [];
let messageCount = 0;

// Create multiple connections to the same conversation
for (let i = 0; i < NUM_CONNECTIONS; i++) {
    const ws = new WebSocket(`ws://localhost:5040/api/ws?convId=${CONV_ID}`);

    ws.on('open', function open() {
        console.log(`Connection ${i + 1}: Connected successfully`);

        // Send a test message from the first connection only
        if (i === 0) {
            setTimeout(() => {
                console.log(`Connection ${i + 1}: Sending test message...`);
                ws.send(JSON.stringify({
                    type: 'user_message',
                    id: 'msg_' + Date.now(),
                    data: {
                        text: 'Hello! This is a test message for multiple connections.'
                    },
                    metadata: {
                        timestamp: Date.now()
                    }
                }));
            }, 2000);
        }
    });

    ws.on('message', function message(data) {
        const parsed = JSON.parse(data);
        messageCount++;

        console.log(`Connection ${i + 1}: Received message #${messageCount} - Type: ${parsed.type}`);

        if (parsed.type === 'llm_chunk') {
            console.log(`  Chunk: "${parsed.data.chunk}"`);
        } else if (parsed.type === 'llm_complete') {
            console.log(`  Complete: "${parsed.data.fullText}"`);
        } else if (parsed.type === 'status') {
            console.log(`  Status: ${parsed.data.status} - ${parsed.data.message || ''}`);
        }
    });

    ws.on('close', function close() {
        console.log(`Connection ${i + 1}: Disconnected`);
    });

    ws.on('error', function error(err) {
        console.error(`Connection ${i + 1}: Error:`, err.message);
    });

    connections.push(ws);
}

// Clean up after test
setTimeout(() => {
    console.log(`\nTest complete. Total messages received: ${messageCount}`);
    console.log('Closing connections...');
    connections.forEach((ws, index) => {
        ws.close();
    });
    process.exit(0);
}, 10000); // Run for 10 seconds