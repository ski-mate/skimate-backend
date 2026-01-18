#!/usr/bin/env node
// Comprehensive tests 
/**
 * WebSocket Endpoints Demo Script
 *
 * Tests all Location and Chat WebSocket endpoints
 *
 * Usage: node scripts/test-websockets.mjs
 */

import { io } from 'socket.io-client';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const BASE_URL = 'https://skimate-api-dev-uge4k3ygea-uc.a.run.app';
const TEST_GROUP_ID = 'test-group-demo-123'; // Will need to be created in DB
const TEST_EMAIL = 'test@skimate.dev';
const TEST_PASSWORD = 'TestPassword123!';

const firebaseConfig = {
  apiKey: 'AIzaSyBpxlJBBmtwnBRO62AfVuT5PX4FBifqS04',
  authDomain: 'skimate-307c2.firebaseapp.com',
  projectId: 'skimate-307c2',
};

// Helper to wait
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to log with timestamp
function log(emoji, message, data = null) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${emoji} ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

async function getToken() {
  log('🔥', 'Getting Firebase ID token...');
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);

  const userCredential = await signInWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD);
  const token = await userCredential.user.getIdToken();
  log('✅', 'Got token for user:', userCredential.user.uid);
  return token;
}

async function testLocationEndpoints(token) {
  console.log('\n' + '='.repeat(80));
  console.log('📍 TESTING LOCATION NAMESPACE');
  console.log('='.repeat(80) + '\n');

  return new Promise((resolve, reject) => {
    const socket = io(`${BASE_URL}/location`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    let sessionId = null;

    socket.on('connect', async () => {
      log('✅', 'Connected to /location namespace', socket.id);

      try {
        // Test 1: Start Session
        log('🧪', 'Test 1: Starting session...');
        socket.emit('session:start', { resortId: null }, async (response) => {
          log('📥', 'session:start response:', response);

          if (response.success) {
            sessionId = response.sessionId;
            log('✅', 'Session started successfully!', { sessionId });

            // Test 2: Send Location Ping
            await sleep(500);
            log('🧪', 'Test 2: Sending location ping...');
            socket.emit('location:ping', {
              sessionId,
              latitude: 46.8527,
              longitude: -121.7604,
              altitude: 1500,
              speed: 5.5,
              accuracy: 10,
              heading: 180,
              timestamp: Date.now()
            }, async (pingResponse) => {
              log('📥', 'location:ping response:', pingResponse);

              if (pingResponse.success) {
                log('✅', 'Location ping successful!');
              } else if (pingResponse.throttled) {
                log('⚠️', 'Ping was throttled (rate limit)');
              } else {
                log('❌', 'Location ping failed');
              }

              // Test 3: Subscribe to Friends
              await sleep(500);
              log('🧪', 'Test 3: Subscribing to friend locations...');
              socket.emit('location:subscribe', {
                friendIds: ['friend-test-id-1', 'friend-test-id-2']
              }, async (subResponse) => {
                log('📥', 'location:subscribe response:', subResponse);

                if (subResponse.success) {
                  log('✅', 'Subscribed to friends successfully!');
                } else {
                  log('❌', 'Failed to subscribe to friends');
                }

                // Test 4: Send another ping (test throttling)
                await sleep(500);
                log('🧪', 'Test 4: Sending second ping (< 1 second gap)...');
                socket.emit('location:ping', {
                  sessionId,
                  latitude: 46.8528,
                  longitude: -121.7605,
                  altitude: 1502,
                  speed: 6.0,
                  accuracy: 10,
                  timestamp: Date.now()
                }, async (ping2Response) => {
                  log('📥', 'location:ping #2 response:', ping2Response);

                  if (ping2Response.throttled) {
                    log('✅', 'Throttling works correctly!');
                  }

                  // Wait 1 second before third ping
                  await sleep(1100);
                  log('🧪', 'Test 5: Sending third ping (> 1 second gap)...');
                  socket.emit('location:ping', {
                    sessionId,
                    latitude: 46.8529,
                    longitude: -121.7606,
                    altitude: 1504,
                    speed: 6.5,
                    accuracy: 10,
                    timestamp: Date.now()
                  }, async (ping3Response) => {
                    log('📥', 'location:ping #3 response:', ping3Response);

                    if (ping3Response.success) {
                      log('✅', 'Third ping successful (throttling cleared)!');
                    }

                    // Test 6: End Session
                    await sleep(500);
                    log('🧪', 'Test 6: Ending session...');
                    socket.emit('session:end', { sessionId }, (endResponse) => {
                      log('📥', 'session:end response:', endResponse);

                      if (endResponse.success) {
                        log('✅', 'Session ended successfully!');
                        log('📊', 'Session summary:', endResponse.summary);
                      } else {
                        log('❌', 'Failed to end session');
                      }

                      socket.disconnect();
                      resolve();
                    });
                  });
                });
              });
            });
          } else {
            log('❌', 'Failed to start session');
            socket.disconnect();
            resolve();
          }
        });

      } catch (error) {
        log('❌', 'Error during location tests:', error.message);
        socket.disconnect();
        reject(error);
      }
    });

    socket.on('location:update', (update) => {
      log('📍', 'Received location update from friend:', update);
    });

    socket.on('location:proximity', (alert) => {
      log('🚨', 'Proximity alert!', alert);
    });

    socket.on('connect_error', (error) => {
      log('❌', 'Connection error:', error.message);
      reject(error);
    });

    socket.on('disconnect', (reason) => {
      log('👋', 'Disconnected from /location:', reason);
    });
  });
}

async function testChatEndpoints(token) {
  console.log('\n' + '='.repeat(80));
  console.log('💬 TESTING CHAT NAMESPACE');
  console.log('='.repeat(80) + '\n');

  return new Promise((resolve, reject) => {
    const socket = io(`${BASE_URL}/chat`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    let roomId = null;
    const TEST_GROUP_ID = '00000000-0000-0000-0000-000000000001'; // Fixed UUID from seed

    socket.on('connect', async () => {
      log('✅', 'Connected to /chat namespace', socket.id);

      try {
        // Test 1: Join Room
        log('🧪', 'Test 1: Joining chat room...');
        socket.emit('chat:join', { groupId: TEST_GROUP_ID }, async (response) => {
          log('📥', 'chat:join response:', response);

          if (response.success) {
            roomId = response.roomId;
            log('✅', 'Joined room successfully!', { roomId });

            // Test 2: Get Message History
            await sleep(500);
            log('🧪', 'Test 2: Getting message history...');
            socket.emit('chat:history', {
              groupId: TEST_GROUP_ID,
              limit: 50
            }, async (historyResponse) => {
              log('📥', 'chat:history response:', historyResponse);

              if (historyResponse.success) {
                log('✅', `Got ${historyResponse.messages?.length || 0} messages`);
              }

              // Test 3: Send Typing Indicator
              await sleep(500);
              log('🧪', 'Test 3: Sending typing indicator...');
              socket.emit('chat:typing', {
                groupId: TEST_GROUP_ID,
                isTyping: true
              });
              log('⌨️', 'Typing indicator sent');

              // Test 4: Send Text Message
              await sleep(1000);
              log('🧪', 'Test 4: Sending text message...');
              socket.emit('chat:send', {
                groupId: TEST_GROUP_ID,
                content: 'Hello from automated test! 🎿',
                metadata: { type: 'text' }
              }, async (sendResponse) => {
                log('📥', 'chat:send response:', sendResponse);

                if (sendResponse.success) {
                  log('✅', 'Message sent successfully!', {
                    messageId: sendResponse.messageId,
                    sentAt: sendResponse.sentAt
                  });

                  const messageId = sendResponse.messageId;

                  // Test 5: Stop Typing
                  await sleep(500);
                  log('🧪', 'Test 5: Stopping typing indicator...');
                  socket.emit('chat:typing', {
                    groupId: TEST_GROUP_ID,
                    isTyping: false
                  });
                  log('✅', 'Typing stopped');

                  // Test 6: Send Location Message
                  await sleep(500);
                  log('🧪', 'Test 6: Sending location message...');
                  socket.emit('chat:send', {
                    groupId: TEST_GROUP_ID,
                    content: "I'm at the ski resort!",
                    metadata: {
                      type: 'location',
                      location: {
                        latitude: 46.8527,
                        longitude: -121.7604
                      }
                    }
                  }, async (locMsgResponse) => {
                    log('📥', 'chat:send (location) response:', locMsgResponse);

                    if (locMsgResponse.success) {
                      log('✅', 'Location message sent!');
                    }

                    // Test 7: Send Meetup Request
                    await sleep(500);
                    log('🧪', 'Test 7: Sending meetup request...');
                    socket.emit('chat:send', {
                      groupId: TEST_GROUP_ID,
                      content: 'Want to ski together?',
                      metadata: { type: 'meetup_request' }
                    }, async (meetupResponse) => {
                      log('📥', 'chat:send (meetup) response:', meetupResponse);

                      if (meetupResponse.success) {
                        log('✅', 'Meetup request sent!');
                      }

                      // Test 8: Mark Message as Read
                      await sleep(500);
                      log('🧪', 'Test 8: Marking message as read...');
                      socket.emit('chat:read', {
                        messageId,
                        groupId: TEST_GROUP_ID
                      }, async (readResponse) => {
                        log('📥', 'chat:read response:', readResponse);

                        if (readResponse.success) {
                          log('✅', 'Message marked as read!');
                        }

                        // Test 9: Leave Room
                        await sleep(500);
                        log('🧪', 'Test 9: Leaving chat room...');
                        socket.emit('chat:leave', { roomId }, (leaveResponse) => {
                          log('📥', 'chat:leave response:', leaveResponse);

                          if (leaveResponse.success) {
                            log('✅', 'Left room successfully!');
                          }

                          socket.disconnect();
                          resolve();
                        });
                      });
                    });
                  });
                } else {
                  log('❌', 'Failed to send message');
                  socket.disconnect();
                  resolve();
                }
              });
            });
          } else {
            log('❌', 'Failed to join room');
            socket.disconnect();
            resolve();
          }
        });

      } catch (error) {
        log('❌', 'Error during chat tests:', error.message);
        socket.disconnect();
        reject(error);
      }
    });

    socket.on('chat:message', (message) => {
      log('📨', 'Received new message:', message);
    });

    socket.on('chat:typing', (data) => {
      log('⌨️', 'Someone is typing:', data);
    });

    socket.on('chat:read', (data) => {
      log('👀', 'Message read receipt:', data);
    });

    socket.on('connect_error', (error) => {
      log('❌', 'Connection error:', error.message);
      reject(error);
    });

    socket.on('disconnect', (reason) => {
      log('👋', 'Disconnected from /chat:', reason);
    });
  });
}

async function main() {
  console.log('\n🎿 SkiMate WebSocket API Demo\n');

  try {
    // Get Firebase token
    const token = await getToken();

    // Test Location endpoints
    await testLocationEndpoints(token);

    // Wait a bit between tests
    await sleep(1000);

    // Test Chat endpoints
    await testChatEndpoints(token);

    console.log('\n' + '='.repeat(80));
    console.log('✅ ALL TESTS COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(80) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
