import { escapeHtml } from '../html-escape.js';

export type SpotOpenedEmailData = {
	guestName: string;
	tripName: string;
	claimWindowHours: number;
	expiresAt: Date;
};

function formatDeadline(d: Date): string {
	return d.toLocaleString('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		timeZoneName: 'short'
	});
}

/**
 * Email sent when a waitlisted guest is promoted to "invited_to_rsvp" — a spot just opened.
 */
export function renderSpotOpenedHtml(d: SpotOpenedEmailData): string {
	const guestName = escapeHtml(d.guestName);
	const tripName = escapeHtml(d.tripName);
	const deadline = escapeHtml(formatDeadline(d.expiresAt));
	const hours = d.claimWindowHours;

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>A spot opened for "${tripName}" — act fast!</title>
  <style>
    body { margin: 0; padding: 0; background: #f5f5f5; font-family: 'Georgia', serif; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .header { background: #1a4a2e; padding: 40px 40px 32px; text-align: center; }
    .header-badge { display: inline-block; background: rgba(255,255,255,0.12); color: #a8d8b8; font-family: 'Arial', sans-serif; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; padding: 6px 16px; border-radius: 20px; margin-bottom: 16px; }
    .header h1 { margin: 0; color: #fff; font-size: 26px; font-weight: normal; line-height: 1.3; }
    .body { padding: 36px 40px; }
    .greeting { font-size: 17px; color: #2c3e50; margin: 0 0 20px; }
    .timer-box { background: #f0fbf4; border: 1.5px solid #a8d8b8; border-radius: 10px; padding: 20px 24px; text-align: center; margin: 24px 0; }
    .timer-label { font-family: 'Arial', sans-serif; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #2e7d4a; margin: 0 0 8px; }
    .timer-value { font-size: 32px; font-weight: bold; color: #1a4a2e; line-height: 1.2; margin: 0 0 6px; }
    .timer-deadline { font-family: 'Arial', sans-serif; font-size: 13px; color: #5a7a63; margin: 0; }
    .cta-row { text-align: center; margin: 28px 0; }
    .cta-btn { display: inline-block; background: #1a4a2e; color: #fff; font-family: 'Arial', sans-serif; font-size: 15px; font-weight: bold; text-decoration: none; padding: 14px 36px; border-radius: 8px; letter-spacing: 0.3px; }
    .info { font-family: 'Arial', sans-serif; font-size: 14px; color: #5a6a72; line-height: 1.7; margin: 0 0 16px; }
    .warning { font-family: 'Arial', sans-serif; font-size: 13px; color: #b05a00; background: #fff8f0; border: 1px solid #f0cfa0; border-radius: 8px; padding: 12px 16px; margin: 0 0 20px; }
    .footer { background: #f8fafb; border-top: 1px solid #e8eef2; padding: 24px 40px; text-align: center; }
    .footer p { font-family: 'Arial', sans-serif; font-size: 12px; color: #8a9ba5; margin: 0; line-height: 1.6; }
    .brand { color: #1a4a2e; font-weight: bold; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="header-badge">Divvi Trips</div>
      <h1>🎉 A spot just opened<br />for "${tripName}"</h1>
    </div>
    <div class="body">
      <p class="greeting">Hi ${guestName},</p>
      <p class="info">
        You're up next on the waitlist — a spot just opened and it's yours to claim!
        Log in to your Divvi dashboard and confirm your RSVP before time runs out.
      </p>
      <div class="timer-box">
        <p class="timer-label">Time to claim your spot</p>
        <p class="timer-value">${hours} hours</p>
        <p class="timer-deadline">Expires: ${deadline}</p>
      </div>
      <div class="warning">
        ⏰ If you don't respond within ${hours} hours, your spot will be offered to the next person on the waitlist.
      </div>
      <p class="info">
        To claim your spot, log in to Divvi and go to the RSVP page for <strong>${tripName}</strong>.
        Select "Going" and confirm your details.
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
