type SlackReportPayload = {
  campaignName: string;
  clientName: string;
  projectName: string;
  weekOf: string;
  stats: {
    emails_sent: number;
    open_rate: number;
    reply_rate: number;
    bounce_rate: number;
    reply_count: number;
  };
  projectUrl: string;
};

export async function postReportToSlack(webhookUrl: string, data: SlackReportPayload) {
  const replyEmoji = data.stats.reply_rate >= 5 ? "🔥" : data.stats.reply_rate >= 2 ? "✅" : "📊";

  const payload = {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${replyEmoji} Weekly Campaign Report — ${data.weekOf}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${data.campaignName}*\n${data.clientName} · ${data.projectName}`,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Emails Sent*\n${data.stats.emails_sent.toLocaleString()}` },
          { type: "mrkdwn", text: `*Open Rate*\n${data.stats.open_rate.toFixed(1)}%` },
          { type: "mrkdwn", text: `*Reply Rate*\n${data.stats.reply_rate.toFixed(1)}% (${data.stats.reply_count} replies)` },
          { type: "mrkdwn", text: `*Bounce Rate*\n${data.stats.bounce_rate.toFixed(1)}%` },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View Full Report →" },
            url: data.projectUrl,
            style: "primary",
          },
        ],
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`Slack webhook error ${res.status}`);
}
