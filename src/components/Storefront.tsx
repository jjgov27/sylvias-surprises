import React from 'react';
import { LOGO_DATA } from '../logo';

export default function Storefront() {
  return (
    <div style={{
      fontFamily: "'Georgia', 'Times New Roman', serif",
      color: '#3a2a1a',
      background: 'linear-gradient(135deg, #2c1810 0%, #4a2c17 50%, #2c1810 100%)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      textAlign: 'center',
    }}>
      {/* Logo */}
      <img
        src={LOGO_DATA}
        alt="Sylvia's Surprises"
        style={{
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          border: '3px solid #c9a96e',
          objectFit: 'cover',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          marginBottom: '20px',
        }}
      />

      {/* Title */}
      <h1 style={{
        color: '#c9a96e',
        fontSize: '2.2rem',
        fontWeight: 'bold',
        margin: '0 0 4px',
        letterSpacing: '2px',
      }}>
        Sylvia&apos;s Surprises
      </h1>
      <p style={{
        color: '#d4b896',
        fontSize: '0.95rem',
        letterSpacing: '3px',
        textTransform: 'uppercase',
        margin: '0 0 28px',
      }}>
        Antiques &bull; Collectibles &bull; Curios
      </p>

      {/* Card */}
      <div style={{
        background: 'rgba(255,255,255,0.95)',
        borderRadius: '14px',
        padding: '32px 28px',
        maxWidth: '440px',
        width: '100%',
        boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
      }}>
        {/* Story */}
        <p style={{
          fontSize: '0.95rem',
          lineHeight: '1.7',
          color: '#5a3e2a',
          margin: '0 0 20px',
          fontStyle: 'italic',
        }}>
          Named in loving memory of Sylvia, Gavin&apos;s dear mother.
          From the treasures she left behind, a wonderful surprise was born.
        </p>

        <div style={{ width: '50px', height: '2px', background: '#c9a96e', margin: '0 auto 20px' }} />

        {/* Opening Times */}
        <div style={{ marginBottom: '18px' }}>
          <p style={{ margin: '0 0 2px', fontWeight: 'bold', color: '#3a2a1a', fontSize: '1rem' }}>
            🕰️ Tuesday – Saturday
          </p>
          <p style={{ margin: 0, color: '#4a2c17', fontSize: '1.1rem', fontWeight: 'bold' }}>
            10am – 5pm
          </p>
        </div>

        {/* Address */}
        <div style={{ marginBottom: '18px' }}>
          <p style={{ margin: 0, lineHeight: '1.5', color: '#5a3e2a', fontSize: '0.95rem' }}>
            📍 Memorial Hall, Main Road<br />
            Union Mills, <strong>IM4 4AD</strong>
          </p>
        </div>

        {/* Contact */}
        <div>
          <p style={{ margin: '0 0 6px' }}>
            <a href="tel:+447624433076" style={{ color: '#4a2c17', textDecoration: 'none', fontWeight: 'bold', fontSize: '1.05rem' }}>
              📞 07624 433076
            </a>
          </p>
          <p style={{ margin: 0 }}>
            <a href="mailto:gavin@sylviassurprises.im" style={{ color: '#8a6d50', textDecoration: 'none', fontSize: '0.9rem' }}>
              ✉️ gavin@sylviassurprises.im
            </a>
          </p>
        </div>
      </div>

      {/* Footer */}
      <p style={{
        color: '#8a6d50',
        fontSize: '0.75rem',
        marginTop: '28px',
      }}>
        &copy; {new Date().getFullYear()} Sylvia&apos;s Surprises &middot; In loving memory of Sylvia 💛
      </p>
    </div>
  );
}
