# SkiMate Authentication Guide

Complete guide for implementing Firebase Authentication with the SkiMate backend in React Native.

## Table of Contents

- [Overview](#overview)
- [Firebase Setup](#firebase-setup)
- [React Native Configuration](#react-native-configuration)
- [Authentication Flow](#authentication-flow)
- [WebSocket Authentication](#websocket-authentication)
- [Token Management](#token-management)
- [Error Handling](#error-handling)

---

## Overview

SkiMate uses **Firebase Authentication** for user identity management. The authentication flow:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  React Native   │────▶│    Firebase     │────▶│ SkiMate Backend │
│      App        │     │  Authentication │     │   (Validates)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │   1. Sign in          │                       │
        │──────────────────────▶│                       │
        │                       │                       │
        │   2. ID Token         │                       │
        │◀──────────────────────│                       │
        │                       │                       │
        │   3. Connect WebSocket with token             │
        │──────────────────────────────────────────────▶│
        │                       │                       │
        │                       │   4. Verify token     │
        │                       │◀──────────────────────│
        │                       │                       │
        │   5. Connection established                   │
        │◀──────────────────────────────────────────────│
```

### Firebase Project Details

| Setting | Value |
|---------|-------|
| Project ID | `skimate-307c2` |
| Project Number | `346673974752` |

---

## Firebase Setup

### 1. Install Firebase Packages

```bash
# Core Firebase
npm install @react-native-firebase/app

# Authentication
npm install @react-native-firebase/auth

# Optional: Google Sign-In
npm install @react-native-google-signin/google-signin
```

### 2. iOS Configuration

1. Download `GoogleService-Info.plist` from Firebase Console
2. Add to your Xcode project (right-click → Add Files)
3. Update `ios/Podfile`:

```ruby
platform :ios, '13.0'

target 'SkiMate' do
  use_frameworks! :linkage => :static
  
  # Firebase requires use_frameworks
  pod 'Firebase', :modular_headers => true
  pod 'FirebaseCore', :modular_headers => true
  pod 'GoogleUtilities', :modular_headers => true
  
  # ... other pods
end
```

4. Run `cd ios && pod install`

### 3. Android Configuration

1. Download `google-services.json` from Firebase Console
2. Place in `android/app/google-services.json`
3. Update `android/build.gradle`:

```groovy
buildscript {
  dependencies {
    classpath 'com.google.gms:google-services:4.4.0'
  }
}
```

4. Update `android/app/build.gradle`:

```groovy
apply plugin: 'com.google.gms.google-services'
```

---

## React Native Configuration

### Initialize Firebase

```typescript
// src/config/firebase.ts
import { firebase } from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';

// Firebase is auto-initialized from config files
// You can check if it's ready:
if (!firebase.apps.length) {
  console.error('Firebase not initialized');
}

export { auth };
```

### Auth Context Provider

```typescript
// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

interface AuthContextType {
  user: FirebaseAuthTypes.User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<FirebaseAuthTypes.User>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await auth().signInWithEmailAndPassword(email, password);
  };

  const signUp = async (email: string, password: string) => {
    const credential = await auth().createUserWithEmailAndPassword(email, password);
    return credential.user;
  };

  const signOut = async () => {
    await auth().signOut();
  };

  const getIdToken = async () => {
    if (!user) return null;
    return user.getIdToken();
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signIn,
      signUp,
      signOut,
      getIdToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

---

## Authentication Flow

### Email/Password Sign Up

```typescript
// screens/SignUpScreen.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const { signUp } = useAuth();

  const handleSignUp = async () => {
    try {
      const user = await signUp(email, password);
      
      // Update display name
      await user.updateProfile({
        displayName: fullName,
      });

      // User is now authenticated
      // Navigation will handle redirect to main app
      
    } catch (error: any) {
      switch (error.code) {
        case 'auth/email-already-in-use':
          Alert.alert('Error', 'An account with this email already exists');
          break;
        case 'auth/invalid-email':
          Alert.alert('Error', 'Invalid email address');
          break;
        case 'auth/weak-password':
          Alert.alert('Error', 'Password should be at least 6 characters');
          break;
        default:
          Alert.alert('Error', error.message);
      }
    }
  };

  return (
    <View>
      <TextInput
        placeholder="Full Name"
        value={fullName}
        onChangeText={setFullName}
      />
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title="Sign Up" onPress={handleSignUp} />
    </View>
  );
}
```

### Email/Password Sign In

```typescript
// screens/SignInScreen.tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn } = useAuth();

  const handleSignIn = async () => {
    try {
      await signIn(email, password);
      // User is now authenticated
    } catch (error: any) {
      switch (error.code) {
        case 'auth/invalid-email':
          Alert.alert('Error', 'Invalid email address');
          break;
        case 'auth/user-not-found':
          Alert.alert('Error', 'No account found with this email');
          break;
        case 'auth/wrong-password':
          Alert.alert('Error', 'Incorrect password');
          break;
        case 'auth/too-many-requests':
          Alert.alert('Error', 'Too many attempts. Please try again later.');
          break;
        default:
          Alert.alert('Error', error.message);
      }
    }
  };

  return (
    <View>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title="Sign In" onPress={handleSignIn} />
    </View>
  );
}
```

### Google Sign-In (Optional)

```typescript
// services/googleAuth.ts
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';

// Configure Google Sign-In (call once on app start)
GoogleSignin.configure({
  webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com', // From Firebase Console
});

export async function signInWithGoogle() {
  try {
    // Check if device supports Google Play Services
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    
    // Get the user's ID token
    const { idToken } = await GoogleSignin.signIn();
    
    // Create a Google credential with the token
    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    
    // Sign in to Firebase with the Google credential
    return auth().signInWithCredential(googleCredential);
  } catch (error) {
    console.error('Google sign-in error:', error);
    throw error;
  }
}
```

### Apple Sign-In (iOS)

```typescript
// services/appleAuth.ts
import auth from '@react-native-firebase/auth';
import { appleAuth } from '@invertase/react-native-apple-authentication';

export async function signInWithApple() {
  // Perform Apple sign-in request
  const appleAuthRequestResponse = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
  });

  // Ensure we have an identity token
  if (!appleAuthRequestResponse.identityToken) {
    throw new Error('Apple Sign-In failed - no identity token');
  }

  // Create Firebase credential
  const { identityToken, nonce } = appleAuthRequestResponse;
  const appleCredential = auth.AppleAuthProvider.credential(identityToken, nonce);

  // Sign in to Firebase
  return auth().signInWithCredential(appleCredential);
}
```

---

## WebSocket Authentication

### Passing Token to Socket.io

The SkiMate backend validates Firebase tokens on WebSocket connection:

```typescript
// services/socket.ts
import { io, Socket } from 'socket.io-client';
import auth from '@react-native-firebase/auth';

const BASE_URL = 'https://skimate-api-dev-uge4k3ygea-uc.a.run.app';

export async function createAuthenticatedSocket(namespace: string): Promise<Socket> {
  const user = auth().currentUser;
  
  if (!user) {
    throw new Error('User must be authenticated to connect');
  }

  // Get fresh ID token
  const token = await user.getIdToken();

  // Create socket with auth
  const socket = io(`${BASE_URL}${namespace}`, {
    transports: ['websocket'],
    auth: {
      token: token,  // Firebase ID token
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  return socket;
}
```

### Socket Manager with Auth

```typescript
// services/SocketManager.ts
import { io, Socket } from 'socket.io-client';
import auth from '@react-native-firebase/auth';

const BASE_URL = 'https://skimate-api-dev-uge4k3ygea-uc.a.run.app';

class SocketManager {
  private locationSocket: Socket | null = null;
  private chatSocket: Socket | null = null;

  async connect(): Promise<void> {
    const user = auth().currentUser;
    if (!user) {
      throw new Error('Not authenticated');
    }

    const token = await user.getIdToken();

    // Connect both namespaces
    this.locationSocket = this.createSocket('/location', token);
    this.chatSocket = this.createSocket('/chat', token);

    // Wait for both to connect
    await Promise.all([
      this.waitForConnection(this.locationSocket),
      this.waitForConnection(this.chatSocket),
    ]);
  }

  private createSocket(namespace: string, token: string): Socket {
    return io(`${BASE_URL}${namespace}`, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
    });
  }

  private waitForConnection(socket: Socket): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      socket.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });

      socket.once('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  getLocationSocket(): Socket {
    if (!this.locationSocket) {
      throw new Error('Not connected');
    }
    return this.locationSocket;
  }

  getChatSocket(): Socket {
    if (!this.chatSocket) {
      throw new Error('Not connected');
    }
    return this.chatSocket;
  }

  disconnect(): void {
    this.locationSocket?.disconnect();
    this.chatSocket?.disconnect();
    this.locationSocket = null;
    this.chatSocket = null;
  }
}

export const socketManager = new SocketManager();
```

---

## Token Management

### Token Expiration

Firebase ID tokens expire after **1 hour**. Handle this automatically:

```typescript
// hooks/useAuthenticatedSocket.ts
import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import auth from '@react-native-firebase/auth';

export function useAuthenticatedSocket(socket: Socket | null) {
  const tokenRefreshInterval = useRef<NodeJS.Timer | null>(null);

  useEffect(() => {
    if (!socket) return;

    // Handle authentication errors
    const handleConnectError = async (error: Error) => {
      if (error.message.includes('Authentication')) {
        console.log('Auth error, refreshing token...');
        try {
          // Force token refresh
          const newToken = await auth().currentUser?.getIdToken(true);
          if (newToken) {
            socket.auth = { token: newToken };
            socket.connect();
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
        }
      }
    };

    socket.on('connect_error', handleConnectError);

    // Proactively refresh token every 50 minutes
    tokenRefreshInterval.current = setInterval(async () => {
      try {
        const newToken = await auth().currentUser?.getIdToken(true);
        if (newToken && socket.connected) {
          // Update auth for next reconnection
          socket.auth = { token: newToken };
        }
      } catch (error) {
        console.error('Proactive token refresh failed:', error);
      }
    }, 50 * 60 * 1000); // 50 minutes

    return () => {
      socket.off('connect_error', handleConnectError);
      if (tokenRefreshInterval.current) {
        clearInterval(tokenRefreshInterval.current);
      }
    };
  }, [socket]);
}
```

### Force Token Refresh

```typescript
// Refresh token before it expires
const refreshToken = async (): Promise<string> => {
  const user = auth().currentUser;
  if (!user) {
    throw new Error('No user signed in');
  }
  
  // Force refresh (true parameter)
  return user.getIdToken(true);
};
```

### Check Token Validity

```typescript
// Get token info for debugging
const getTokenInfo = async () => {
  const user = auth().currentUser;
  if (!user) return null;

  const tokenResult = await user.getIdTokenResult();
  
  return {
    token: tokenResult.token,
    expirationTime: tokenResult.expirationTime,
    issuedAtTime: tokenResult.issuedAtTime,
    claims: tokenResult.claims,
  };
};
```

---

## Error Handling

### Firebase Auth Errors

| Error Code | Description | User Message |
|------------|-------------|--------------|
| `auth/email-already-in-use` | Email registered | "An account with this email already exists" |
| `auth/invalid-email` | Bad email format | "Please enter a valid email address" |
| `auth/user-not-found` | No account | "No account found with this email" |
| `auth/wrong-password` | Bad password | "Incorrect password" |
| `auth/weak-password` | Password too short | "Password must be at least 6 characters" |
| `auth/too-many-requests` | Rate limited | "Too many attempts. Please try again later" |
| `auth/network-request-failed` | No internet | "Please check your internet connection" |
| `auth/user-disabled` | Account disabled | "This account has been disabled" |

### WebSocket Auth Errors

```typescript
socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error.message);
  
  if (error.message === 'Authentication error') {
    // Token invalid or expired
    // Try to refresh and reconnect
  }
  
  if (error.message === 'timeout') {
    // Network issue
    // Will auto-retry based on reconnection settings
  }
});
```

### Error Handler Utility

```typescript
// utils/authErrors.ts
export function getAuthErrorMessage(error: any): string {
  const errorMessages: Record<string, string> = {
    'auth/email-already-in-use': 'An account with this email already exists',
    'auth/invalid-email': 'Please enter a valid email address',
    'auth/user-not-found': 'No account found with this email',
    'auth/wrong-password': 'Incorrect password',
    'auth/weak-password': 'Password must be at least 6 characters',
    'auth/too-many-requests': 'Too many attempts. Please try again later',
    'auth/network-request-failed': 'Please check your internet connection',
    'auth/user-disabled': 'This account has been disabled',
  };

  return errorMessages[error.code] || error.message || 'An unexpected error occurred';
}
```

---

## Security Best Practices

1. **Never store tokens locally** - Firebase SDK handles token caching securely
2. **Always use HTTPS/WSS** - All connections must be encrypted
3. **Validate on backend** - The SkiMate backend verifies every token
4. **Handle sign-out properly** - Disconnect sockets when user signs out
5. **Use latest SDK versions** - Keep Firebase packages updated

```typescript
// Proper sign-out flow
const handleSignOut = async () => {
  // 1. Disconnect all sockets first
  socketManager.disconnect();
  
  // 2. Sign out from Firebase
  await auth().signOut();
  
  // 3. Clear any local state
  // Navigation will handle redirect to sign-in
};
```

---

## Additional Resources

- [Firebase Auth Documentation](https://firebase.google.com/docs/auth)
- [React Native Firebase](https://rnfirebase.io/)
- [API Guide](./API.md) - Complete WebSocket API documentation
- [Data Models](./MODELS.md) - TypeScript interfaces
