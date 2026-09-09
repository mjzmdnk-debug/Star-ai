# STAR AI Mobile

React Native mobile client for STAR AI using Expo SDK 57 and Expo Router.

## Development

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go, or run the Android/iOS target from the Expo CLI.

The app connects to the production API at `https://star-ai-kmfd.onrender.com`.

## Current foundation

- Expo SDK 57 + TypeScript
- Expo Router navigation
- SecureStore access/refresh token storage
- Mobile login/register/refresh session
- Arabic-first landing and chat UI
- Bearer-authenticated STAR AI chat
- Credits displayed from the API

## Next

- Turkish and English runtime language switcher
- Conversation history
- Image analysis and editing
- Web research UI
- Native media picker and sharing
- EAS development/preview/production builds
