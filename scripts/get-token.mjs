#!/usr/bin/env node
// Firebase token generator 
/**
 * Get Firebase ID Token for WebSocket Testing
 * Uses Firebase Web SDK (client-side)
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBpxlJBBmtwnBRO62AfVuT5PX4FBifqS04',
  authDomain: 'skimate-307c2.firebaseapp.com',
  projectId: 'skimate-307c2',
};

const TEST_EMAIL = 'test@skimate.dev';
const TEST_PASSWORD = 'TestPassword123!';

async function main() {
  console.log('🔥 Initializing Firebase...\n');

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);

  try {
    let userCredential;

    // Try to sign in first
    try {
      console.log(`📝 Signing in as ${TEST_EMAIL}...`);
      userCredential = await signInWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD);
      console.log('✅ Signed in successfully!\n');
    } catch (error) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        // User doesn't exist, create new one
        console.log('👤 User not found. Creating new user...');
        userCredential = await createUserWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD);
        console.log('✅ User created successfully!\n');
      } else {
        throw error;
      }
    }

    const user = userCredential.user;
    const idToken = await user.getIdToken();

    console.log('='.repeat(80));
    console.log('✨ FIREBASE ID TOKEN (Valid for 1 hour)');
    console.log('='.repeat(80));
    console.log(idToken);
    console.log('='.repeat(80));
    console.log(`\nUser ID: ${user.uid}`);
    console.log(`Email: ${user.email}`);
    console.log('\n📋 COPY THE TOKEN ABOVE AND USE IT TO TEST WEBSOCKETS\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.code || error.message);
    console.error('\nDetails:', error);
    process.exit(1);
  }
}

main();
