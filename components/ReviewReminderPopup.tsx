'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function ReviewReminderPopup() {
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    const checkAndNotify = async () => {
      // Get stored player ID from localStorage
      const playerId = localStorage.getItem('onesignal_player_id');
      if (!playerId) return;

      const { data, error } = await supabase
        .from('push_sessions')
        .select('session_start, notification_sent')
        .eq('player_id', playerId)
        .order('session_start', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return;

      const diff = Date.now() - new Date(data.session_start).getTime();
      const thirtyMins = 30 * 60 * 1000;

      if (diff >= thirtyMins && !data.notification_sent) {
        setShowPopup(true);

        // Mark as sent in Supabase so it doesn't show again
        await supabase
          .from('push_sessions')
          .update({
            notification_sent: true,
            notification_sent_at: new Date().toISOString(),
          })
          .eq('player_id', playerId);
      }
    };

    // Check every 60 seconds
    const interval = setInterval(checkAndNotify, 60000);
    checkAndNotify(); // also check immediately on mount

    return () => clearInterval(interval);
  }, []);

  if (!showPopup) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'oklch(0.18 0.025 50)',
      color: 'oklch(0.88 0.09 80)',
      padding: '20px 24px',
      borderRadius: '16px',
      border: '1px solid oklch(0.82 0.13 82 / 0.3)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      zIndex: 9999,
      textAlign: 'center',
      maxWidth: '320px',
      width: '90%',
    }}>
      <div style={{ fontSize: '28px', marginBottom: '8px' }}>⭐</div>
      <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '6px' }}>
        Enjoying your meal at Taksh?
      </div>
      <div style={{ fontSize: '14px', color: 'oklch(0.7 0.07 75)', marginBottom: '16px' }}>
        Your review means a lot to us!
      </div>
      
      <a
        href="https://google.com/maps/place/TAKSH+Veg/@18.6412482,73.7539021,17z/data=!4m8!3m7!1s0x3bc2b9f2ecc97da9:0xbe640886b8aa715f!8m2!3d18.6412431!4d73.756477!9m1!1b1!16s%2Fg%2F11jzpjmcr9?entry=ttu&g_ep=EgoyMDI2MDMxOC4xIKXMDSoASAFQAw%3D%3D"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          background: 'oklch(0.82 0.13 82)',
          color: 'oklch(0.18 0.025 50)',
          padding: '10px 20px',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: 'bold',
          display: 'inline-block',
          marginBottom: '10px',
        }}
      >
        Leave a Review ⭐
      </a>
      <br />
      <button
        onClick={() => setShowPopup(false)}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'oklch(0.7 0.07 75)',
          fontSize: '13px',
          cursor: 'pointer',
          marginTop: '6px',
        }}
      >
        Maybe later
      </button>
    </div>
  );
}
