import { Resend } from "resend";

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
  return new Resend(process.env.RESEND_API_KEY);
}

export type CampaignReportEmailData = {
  to: string;
  userName: string;
  projectName: string;
  clientName: string;
  campaignName: string;
  weekOf: string;
  stats: {
    leads_count: number;
    emails_sent: number;
    open_count: number;
    reply_count: number;
    bounce_count: number;
    open_rate: number;
    reply_rate: number;
    bounce_rate: number;
    new_leads_contacted: number;
  };
  projectUrl: string;
};

function buildEmailHtml(data: CampaignReportEmailData): string {
  const { stats } = data;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://campaignflowpro.com";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Weekly Campaign Report</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;">
            <p style="margin:0;color:rgba(255,255,255,0.8);font-size:13px;letter-spacing:0.5px;text-transform:uppercase;">CampaignFlow Pro</p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:24px;font-weight:700;">Weekly Campaign Report</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Week of ${data.weekOf}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 8px;color:#71717a;font-size:14px;">Hi ${data.userName},</p>
            <p style="margin:0 0 24px;color:#18181b;font-size:15px;">
              Here's your weekly performance summary for <strong>${data.campaignName}</strong>
              (${data.clientName} — ${data.projectName}).
            </p>

            <!-- Stats grid -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td width="50%" style="padding:0 8px 16px 0;">
                  <div style="background:#f4f4f5;border-radius:8px;padding:16px 20px;">
                    <p style="margin:0;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Emails Sent</p>
                    <p style="margin:4px 0 0;color:#18181b;font-size:28px;font-weight:700;">${stats.emails_sent.toLocaleString()}</p>
                  </div>
                </td>
                <td width="50%" style="padding:0 0 16px 8px;">
                  <div style="background:#f4f4f5;border-radius:8px;padding:16px 20px;">
                    <p style="margin:0;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Open Rate</p>
                    <p style="margin:4px 0 0;color:#18181b;font-size:28px;font-weight:700;">${stats.open_rate.toFixed(1)}%</p>
                  </div>
                </td>
              </tr>
              <tr>
                <td width="50%" style="padding:0 8px 16px 0;">
                  <div style="background:#ecfdf5;border-radius:8px;padding:16px 20px;border:1px solid #bbf7d0;">
                    <p style="margin:0;color:#15803d;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Reply Rate</p>
                    <p style="margin:4px 0 0;color:#15803d;font-size:28px;font-weight:700;">${stats.reply_rate.toFixed(1)}%</p>
                    <p style="margin:2px 0 0;color:#71717a;font-size:12px;">${stats.reply_count} replies</p>
                  </div>
                </td>
                <td width="50%" style="padding:0 0 16px 8px;">
                  <div style="background:#f4f4f5;border-radius:8px;padding:16px 20px;">
                    <p style="margin:0;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Bounce Rate</p>
                    <p style="margin:4px 0 0;color:#18181b;font-size:28px;font-weight:700;">${stats.bounce_rate.toFixed(1)}%</p>
                    <p style="margin:2px 0 0;color:#71717a;font-size:12px;">${stats.bounce_count} bounces</p>
                  </div>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 24px;">
                  <a href="${data.projectUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
                    View Full Report →
                  </a>
                </td>
              </tr>
            </table>

            <hr style="border:none;border-top:1px solid #e4e4e7;margin:0 0 20px;">
            <p style="margin:0;color:#a1a1aa;font-size:12px;">
              This report was automatically generated by CampaignFlow Pro.
              You're receiving this because weekly reporting is enabled for this project.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f4f4f5;padding:16px 40px;border-top:1px solid #e4e4e7;">
            <p style="margin:0;color:#a1a1aa;font-size:12px;text-align:center;">
              <a href="${appUrl}" style="color:#6366f1;text-decoration:none;">CampaignFlow Pro</a>
              · Automated campaign reporting
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();
}

export async function sendCampaignReportEmail(data: CampaignReportEmailData) {
  const resend = getResend();
  const { error } = await resend.emails.send({
    from: "CampaignFlow Pro <reports@campaignflowpro.com>",
    to: data.to,
    subject: `📊 Weekly Report: ${data.campaignName} — ${data.weekOf}`,
    html: buildEmailHtml(data),
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}
