#!/usr/bin/env node

// Test to verify streaming fix works correctly

const WebSocket = require('ws');

const CONV_ID = 'test-streaming-fix-' + Date.now();

console.log(`Testing streaming fix for conversation: ${CONV_ID}`);

let connection2Opened = false;

// First connection - start a message
const ws1 = new WebSocket(`ws://localhost:5040/api/ws?convId=${CONV_ID}`);

ws1.on('open', function open() {
    console.log('Connection 1: Connected - will send a message after 2 seconds');

    setTimeout(() => {
        console.log('Connection 1: Sending test message...');
        ws1.send(JSON.stringify({
            type: 'user_message',
            id: 'msg_' + Date.now(),
            data: {
                text: 'This is a test message to verify streaming works correctly. Please respond with a medium-length message so we can test the accumulation and broadcasting functionality.'
            },
            metadata: {
                timestamp: Date.now()
            }
        }));
    }, 2000);
});

ws1.on('message', function message(data) {
    const parsed = JSON.parse(data);
    console.log(`Connection 1: ${parsed.type} - ${parsed.type === 'llm_chunk' ? 'chunk length: ' + (parsed.data?.chunk?.length || 0) : parsed.type === 'llm_complete' ? 'complete length: ' + (parsed.data?.fullText?.length || 0) : parsed.type}`);

    // When we receive first few chunks, open second connection
    if (parsed.type === 'llm_chunk' && !connection2Opened) {
        connection2Opened = true;
        setTimeout(() => {
            console.log('Opening Connection 2 while streaming is active...');
            openSecondConnection();
        }, 100);
    }
});

function openSecondConnection() {
    const ws2 = new WebSocket(`ws://localhost:5040/api/ws?convId=${CONV_ID}`);

    ws2.on('open', function open() {
        console.log('Connection 2: Connected - should receive accumulated chunks');
    });

    ws2.on('message', function message(data) {
        const parsed = JSON.parse(data);
        console.log(`Connection 2: ${parsed.type} - ${parsed.type === 'llm_chunk' ? 'chunk length: ' + (parsed.data?.chunk?.length || 0) + (parsed.data?.isAccumulated ? ' (ACCUMULATED)' : ' (LIVE)') : parsed.type === 'llm_complete' ? 'complete length: ' + (parsed.data?.fullText?.length || 0) + (parsed.data?.isAccumulated ? ' (ACCUMULATED)' : ' (LIVE)') : parsed.type}`);
    });

    ws2.on('close', function close() {
        console.log('Connection 2: Disconnected');
    });

    ws2.on('error', function error(err) {
        console.error('Connection 2: Error:', err.message);
    });
}

ws1.on('close', function close() {
    console.log('Connection 1: Disconnected');
});

ws1.on('error', function error(err) {
    console.error('Connection 1: Error:', err.message);
});

// Clean up after 15 seconds
setTimeout(() => {
    console.log('\nTest complete. Cleaning up...');
    process.exit(0);
}, 15000);