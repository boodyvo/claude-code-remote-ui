# Ticket 016 — PWA Setup

**Phase:** 3 — Voice & Mobile
**Effort:** M
**Depends on:** Ticket 13

## Summary

Configure the app as an installable Progressive Web App with service worker caching, push notifications for long-running tasks, and an install prompt for mobile users.

## Acceptance Criteria

- [ ] `manifest.json` in `/public/` with app name, icons, standalone display, theme colors
- [ ] PWA icons: 192x192, 512x512 (regular + maskable)
- [ ] Service worker via `@serwist/next`:
  - App shell (HTML, CSS, JS): **cache-first** (precache)
  - API responses: **network-first** with cache fallback
  - Static assets (fonts, icons): **cache-first**
- [ ] App installable on:
  - Android: `beforeinstallprompt` → custom install button
  - iOS: custom banner with "Add to Home Screen" instructions
- [ ] Push notifications (Web Push API + VAPID):
  - Server generates VAPID keys on first run, stores in SQLite
  - Client subscribes via `pushManager.subscribe()`
  - Subscription endpoint stored server-side per user
  - Push sent on:
    - Long-running task completion
    - Session error (rate limit, auth expired)
  - Notification click opens the relevant session
- [ ] `display: standalone` mode detected and styled appropriately
- [ ] Offline page: show "Offline — reconnecting..." with cached app shell

## Implementation Notes

### @serwist/next Integration
```typescript
// next.config.ts
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
});

export default withSerwist(nextConfig);
```

### Service Worker (src/sw.ts)
```typescript
import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  runtimeCaching: defaultCache,
  skipWaiting: true,
  clientsClaim: true,
});

// Push notification handler
self.addEventListener("push", (event) => {
  const data = event.data?.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      data: { sessionId: data.sessionId },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(`/?session=${event.notification.data.sessionId}`));
});

serwist.addEventListeners();
```

### iOS Install Banner
Detect iOS via user agent, show custom bottom sheet with step-by-step instructions. Dismiss permanently via localStorage flag.

### Push Notification Server
Use `web-push` npm package. Generate VAPID keys once, store in DB.

## Tests

- [ ] **Unit:** Manifest.json is valid (all required fields present)
- [ ] **Unit:** Service worker registers without errors
- [ ] **Unit:** Push notification handler shows notification with correct data
- [ ] **Integration:** Install prompt appears on Android
- [ ] **Integration:** iOS banner appears with correct instructions
- [ ] **Integration:** Push subscription round-trip (subscribe → store → send → receive)
- [ ] **E2E:** App loads in standalone mode after install

## Files to Create/Modify

- `public/manifest.json`
- `public/icons/` (icon files)
- `src/sw.ts`
- `src/lib/push-notifications.ts` (client-side subscription)
- `src/server/push.ts` (server-side push sending)
- `src/components/layout/install-banner.tsx`
- Modify `next.config.ts` for serwist

## Dependencies to Add

- `@serwist/next`
- `serwist`
- `web-push`
