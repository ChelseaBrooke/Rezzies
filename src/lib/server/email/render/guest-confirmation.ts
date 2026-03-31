import { escapeHtml } from '../html-escape.js';

export type GuestConfirmationEmailData = {
	guestName: string;
	roomName: string;
	bedType: string;
	checkInDate: string;
	checkOutDate: string;
	nights: number;
	totalPrice: string;
	confirmationUrl: string;
};

export function renderGuestConfirmationHtml(d: GuestConfirmationEmailData): string {
	const guestName = escapeHtml(d.guestName);
	const roomName = escapeHtml(d.roomName);
	const bedType = escapeHtml(d.bedType);
	const checkInDate = escapeHtml(d.checkInDate);
	const checkOutDate = escapeHtml(d.checkOutDate);
	const nights = String(d.nights);
	const totalPrice = escapeHtml(d.totalPrice);
	const confirmationUrl = escapeHtml(d.confirmationUrl);

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>Booking confirmed</title>
	<style type="text/css">
		body { margin:0; padding:0; background:#eef5f5; font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif; }
		.card { max-width:560px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 12px 40px rgba(29,77,78,0.12); }
		.hero { background:linear-gradient(135deg,#2f7778 0%,#1d4d4e 100%); padding:28px 32px; color:#fff; }
		.hero h1 { font-family:Georgia,'Times New Roman',serif; font-size:24px; margin:0 0 8px; }
		.body { padding:28px 32px; color:#111827; font-size:15px; line-height:1.6; }
		.meta td { padding:8px 0; border-bottom:1px solid rgba(47,119,120,0.12); font-size:14px; }
		.meta .l { font-weight:600; color:#2f7778; width:40%; }
		.btn { display:inline-block; background:#ce5612; color:#fff !important; text-decoration:none; font-weight:700; padding:14px 24px; border-radius:10px; margin-top:20px; }
		.footer { text-align:center; font-size:12px; color:#9ca3af; padding:24px; }
	</style>
</head>
<body>
	<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="padding:32px 16px;">
		<div class="card">
			<div style="height:4px;background:linear-gradient(90deg,#7aced3 0%,#e3ceaa 50%,#ce5612 100%);"></div>
			<div class="hero">
				<h1>You’re booked</h1>
				<p style="margin:0; opacity:0.95;">Hi ${guestName}, here’s your stay summary.</p>
			</div>
			<div class="body">
				<table class="meta" width="100%" cellpadding="0" cellspacing="0" role="presentation">
					<tr><td class="l">Room</td><td>${roomName}</td></tr>
					<tr><td class="l">Bed</td><td>${bedType}</td></tr>
					<tr><td class="l">Check-in</td><td>${checkInDate}</td></tr>
					<tr><td class="l">Check-out</td><td>${checkOutDate}</td></tr>
					<tr><td class="l">Nights</td><td>${nights}</td></tr>
					<tr><td class="l">Total</td><td>$${totalPrice}</td></tr>
				</table>
				<a class="btn" href="${confirmationUrl}" target="_blank" rel="noopener">View confirmation</a>
			</div>
		</div>
		<p class="footer">Sent by Divvi</p>
	</td></tr></table>
</body>
</html>`;
}
