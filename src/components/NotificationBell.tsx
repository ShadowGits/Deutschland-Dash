'use client';

import React, { useState, useEffect } from 'react';
import { Bell, BellRing, Loader2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_PLANNER_API_URL || 'https://planner-os-api-645411441153.us-central1.run.app';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getDeviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPad/.test(ua)) return 'iPad';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows';
  return 'Browser';
}

export default function NotificationBell() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission);

    // Check if already subscribed
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    });
  }, []);

  const handleClick = async () => {
    if (permission === 'unsupported') return;
    if (subscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const subscribe = async () => {
    setLoading(true);
    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setLoading(false);
        return;
      }

      // Get VAPID key from backend
      const appKey = document.querySelector<HTMLMetaElement>('meta[name="x-app-key"]')?.content || '';
      const vapidRes = await fetch(`${API_BASE}/v2/push/vapid-key`, {
        headers: { 'X-App-Key': appKey },
      });
      if (!vapidRes.ok) throw new Error('Failed to get VAPID key');
      const vapidData = await vapidRes.json();
      const vapidKey = vapidData.data.public_key;

      // Subscribe to push
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      // Send subscription to backend
      const subJson = sub.toJSON();
      const res = await fetch(`${API_BASE}/v2/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Key': appKey },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          device_label: getDeviceLabel(),
        }),
      });

      if (res.ok) {
        setSubscribed(true);
      }
    } catch (err) {
      console.error('Push subscription failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const appKey = document.querySelector<HTMLMetaElement>('meta[name="x-app-key"]')?.content || '';
        await fetch(`${API_BASE}/v2/push/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-App-Key': appKey },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (err) {
      console.error('Unsubscribe failed:', err);
    } finally {
      setLoading(false);
    }
  };

  if (permission === 'unsupported') return null;

  return (
    <button
      onClick={handleClick}
      disabled={loading || permission === 'denied'}
      className={`relative p-2 rounded-lg transition-all ${
        subscribed
          ? 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
      } ${permission === 'denied' ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={
        permission === 'denied'
          ? 'Notifications blocked — enable in browser settings'
          : subscribed
          ? 'Notifications on — click to turn off'
          : 'Turn on task reminders'
      }
    >
      {loading ? (
        <Loader2 size={20} className="animate-spin" />
      ) : subscribed ? (
        <BellRing size={20} />
      ) : (
        <Bell size={20} />
      )}
      {subscribed && (
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-white" />
      )}
    </button>
  );
}
