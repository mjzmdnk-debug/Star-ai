# STAR AI Mobile

React Native mobile client for STAR AI using Expo SDK 57 and Expo Router.

## Development

```bash
cd mobile
npm install
npx expo start
```

The app connects to the production API at `https://star-ai-kmfd.onrender.com`.

## Implemented

- Expo SDK 57 + TypeScript
- Expo Router navigation
- SecureStore access/refresh token storage
- Automatic access-token refresh and one-request retry
- Mobile login/register/refresh/me
- Arabic-first premium dark UI
- Arabic / English / Turkish language switcher with persistence
- Bearer-authenticated STAR AI chat
- Credits synchronized from the API
- Image analysis
- Camera capture
- Gallery image selection
- Native camera/photo permissions
- Settings screen with logout and haptics
- EAS development/preview/production build profiles

## CI release gates

The `mobile-app` branch runs these checks automatically:

1. Install dependencies with Node 22
2. Verify resolved Expo package versions
3. Run `expo-doctor`
4. Validate Expo configuration
5. Validate native prebuild configuration
6. Run TypeScript type checking

## EAS builds

Authenticate with the Expo account that owns the project, then from `mobile/`:

```bash
eas build --platform android --profile production
eas build --platform ios --profile production
```

For a store-ready release, production builds should be tested before submission. Expo recommends production builds for App Store / Google Play distribution rather than relying on Expo Go for release validation.

## Store submission

```bash
eas submit --platform android --profile production
eas submit --platform ios --profile production
```

The actual store submission additionally requires the developer accounts and signing credentials for Google Play and Apple Developer. Store listing metadata, screenshots, privacy details, and review information are managed in the respective store consoles.

## Release checklist

- [x] Android package: `com.starai.app`
- [x] iOS bundle identifier: `com.starai.app`
- [x] Camera and photo permissions configured
- [x] Production EAS profile configured
- [x] Auto-increment enabled for production builds
- [x] CI: Expo Doctor passes
- [x] CI: Expo config validation passes
- [x] CI: native prebuild validation passes
- [x] CI: TypeScript passes
- [ ] Run real Android production build
- [ ] Run real iOS production build
- [ ] Install and smoke-test release builds on physical devices
- [ ] Prepare final app icon/splash artwork
- [ ] Prepare store screenshots and listing metadata
- [ ] Complete privacy/data-safety declarations
- [ ] Submit to stores
