import { escapeHtml } from '../html-escape.js';

export type SpotOpenedEmailData = {
	guestName: string;
	tripName: string;
	spotsAvailable: number;
};

/**
 * Email sent to ALL waitlisted guests when spots open on a trip.
 * It's first come, first served — whoever RSVPs yes first gets in.
 */
export function renderSpotOpenedHtml(d: SpotOpenedEmailData): string {
	const guestName = escapeHtml(d.guestName);
	const tripName = escapeHtml(d.tripName);
	const count = d.spotsAvailable;
	const spotWord = count === 1 ? 'spot' : 'spots';
	const headline = count === 1 ? 'A spot just opened!' : `${count} spots just opened!`;

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${headline} — "${tripName}"</title>
  <style>
    body { margin: 0; padding: 0; background: #f5f5f5; font-family: 'Georgia', serif; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .header { background: #1a4a2e; padding: 40px 40px 32px; text-align: center; }
    .header-badge { display: inline-block; background: rgba(255,255,255,0.12); color: #a8d8b8; font-family: 'Arial', sans-serif; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; padding: 6px 16px; border-radius: 20px; margin-bottom: 16px; }
    .header h1 { margin: 0; color: #fff; font-size: 26px; font-weight: normal; line-height: 1.3; }
    .body { padding: 36px 40px; }
    .greeting { font-size: 17px; color: #2c3e50; margin: 0 0 20px; }
    .spots-box { background: #f0fbf4; border: 1.5px solid #a8d8b8; border-radius: 10px; padding: 20px 24px; text-align: center; margin: 24px 0; }
    .spots-label { font-family: 'Arial', sans-serif; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #2e7d4a; margin: 0 0 8px; }
    .spots-value { font-size: 36px; font-weight: bold; color: #1a4a2e; line-height: 1.2; margin: 0 0 4px; }
    .spots-note { font-family: 'Arial', sans-serif; font-size: 13px; color: #5a7a63; margin: 0; }
    .cta-row { text-align: center; margin: 28px 0; }
    .cta-btn { display: inline-block; background: #1a4a2e; color: #fff; font-family: 'Arial', sans-serif; font-size: 15px; font-weight: bold; text-decoration: none; padding: 14px 36px; border-radius: 8px; letter-spacing: 0.3px; }
    .info { font-family: 'Arial', sans-serif; font-size: 14px; color: #5a6a72; line-height: 1.7; margin: 0 0 16px; }
    .footer { background: #f8fafb; border-top: 1px solid #e8eef2; padding: 24px 40px; text-align: center; }
    .footer p { font-family: 'Arial', sans-serif; font-size: 12px; color: #8a9ba5; margin: 0; line-height: 1.6; }
    .brand { color: #1a4a2e; font-weight: bold; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="header-badge">Divvi Trips</div>
      <h1>🎉 ${escapeHtml(headline)}<br />for "${tripName}"</h1>
    </div>
    <div class="body">
      <p class="greeting">Hi ${guestName},</p>
      <p class="info">
        Good news — ${count === 1 ? 'a spot has' : `${count} spots have`} just opened up on
        <strong>${tripName}</strong>. This is first come, first served, so head over and
        RSVP yes now if you want in.
      </p>
      <div class="spots-box">
        <p class="spots-label">Open ${spotWord} right now</p>
        <p class="spots-value">${count}</p>
        <p class="spots-note">First come, first served — no time window</p>
      </div>
      <div class="cta-row">
        <a href="#" class="cta-btn">RSVP Now →</a>
      </div>
      <p class="info">
        Log in to your Divvi dashboard, find <strong>${tripName}</strong>, and submit your RSVP.
        If the ${spotWord} ${count === 1 ? 'fills' : 'fill'} before you do, you'll stay on the waitlist
        and we'll notify you again if another spot opens.
      </p>
    </div>
    <div class="footer">
      <p>You received this because you were on the waitlist for <strong>${tripName}</strong>.<br />
      Powered by <span class="brand">Divvi</span>.</p>
    </div>
  </div>
</body>
</html>`;
}
