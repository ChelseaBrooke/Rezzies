import { escapeHtml } from '../html-escape.js';

export type WaitlistAddedEmailData = {
	guestName: string;
	tripName: string;
	waitlistPosition: number;
};

/**
 * Email sent when a guest is added to a waitlist because the trip reached capacity.
 */
export function renderWaitlistAddedHtml(d: WaitlistAddedEmailData): string {
	const guestName = escapeHtml(d.guestName);
	const tripName = escapeHtml(d.tripName);
	const position = d.waitlistPosition;

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're on the waitlist — ${tripName}</title>
  <style>
    body { margin: 0; padding: 0; background: #f5f5f5; font-family: 'Georgia', serif; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .header { background: #1a3a4a; padding: 40px 40px 32px; text-align: center; }
    .header-badge { display: inline-block; background: rgba(255,255,255,0.12); color: #b8d4e0; font-family: 'Arial', sans-serif; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; padding: 6px 16px; border-radius: 20px; margin-bottom: 16px; }
    .header h1 { margin: 0; color: #fff; font-size: 26px; font-weight: normal; line-height: 1.3; }
    .body { padding: 36px 40px; }
    .greeting { font-size: 17px; color: #2c3e50; margin: 0 0 20px; }
    .position-box { background: #f0f7fb; border: 1.5px solid #b8d4e0; border-radius: 10px; padding: 20px 24px; text-align: center; margin: 24px 0; }
    .position-label { font-family: 'Arial', sans-serif; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #5a8fa3; margin: 0 0 8px; }
    .position-number { font-size: 42px; font-weight: bold; color: #1a3a4a; line-height: 1; margin: 0; }
    .info { font-family: 'Arial', sans-serif; font-size: 14px; color: #5a6a72; line-height: 1.7; margin: 0 0 20px; }
    .footer { background: #f8fafb; border-top: 1px solid #e8eef2; padding: 24px 40px; text-align: center; }
    .footer p { font-family: 'Arial', sans-serif; font-size: 12px; color: #8a9ba5; margin: 0; line-height: 1.6; }
    .brand { color: #1a3a4a; font-weight: bold; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="header-badge">Divvi Trips</div>
      <h1>You're on the waitlist<br />for "${tripName}"</h1>
    </div>
    <div class="body">
      <p class="greeting">Hi ${guestName},</p>
      <p class="info">
        Great news — you're still in the running for this trip! The trip is currently full,
        so we've placed you on the waitlist. If a spot opens up, we'll notify you right away.
      </p>
      <div class="position-box">
        <p class="position-label">Your waitlist position</p>
        <p class="position-number">#${position}</p>
      </div>
      <p class="info">
        Spots are offered on a first-come, first-served basis. When it's your turn,
        you'll receive a new email with a time-limited link to claim your spot — so keep an eye on your inbox.
      </p>
      <p class="info">
        Questions? Reply to this email or reach out to your trip host directly.
      </p>
    </div>
    <div class="footer">
      <p>You received this because you were invited to <strong>${tripName}</strong>.<br />
      Powered by <span class="brand">Divvi</span>.</p>
    </div>
  </div>
</body>
</html>`;
}
