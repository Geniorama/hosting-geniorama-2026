function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function tryEnv(name: string): string | undefined {
  return process.env[name];
}

export type MailRecipient = { email: string; name?: string };

export type SendMailInput = {
  to: MailRecipient | MailRecipient[];
  subject: string;
  html: string;
  text?: string;
  bcc?: MailRecipient[];
  replyTo?: MailRecipient;
};

type ZeptoBody = {
  from: { address: string; name?: string };
  to: Array<{ email_address: { address: string; name?: string } }>;
  bcc?: Array<{ email_address: { address: string; name?: string } }>;
  subject: string;
  htmlbody: string;
  textbody?: string;
  reply_to?: Array<{ address: string; name?: string }>;
};

export async function sendMail(input: SendMailInput): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  const apiUrl = (tryEnv("ZEPTOMAIL_API_URL") ?? "https://api.zeptomail.com/v1.1/email").replace(/\/$/, "");
  const apiToken = getEnv("ZEPTOMAIL_TOKEN");
  const fromAddress = getEnv("MAIL_FROM_ADDRESS");
  const fromName = tryEnv("MAIL_FROM_NAME") ?? "Geniorama";

  const recipients = Array.isArray(input.to) ? input.to : [input.to];

  const body: ZeptoBody = {
    from: { address: fromAddress, name: fromName },
    to: recipients.map((r) => ({ email_address: { address: r.email, name: r.name } })),
    subject: input.subject,
    htmlbody: input.html,
  };
  if (input.text) body.textbody = input.text;
  if (input.bcc?.length) {
    body.bcc = input.bcc.map((r) => ({ email_address: { address: r.email, name: r.name } }));
  }
  if (input.replyTo) {
    body.reply_to = [{ address: input.replyTo.email, name: input.replyTo.name }];
  }

  let res: Response;
  try {
    res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: apiToken.startsWith("Zoho-enczapikey ") ? apiToken : `Zoho-enczapikey ${apiToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, error: `ZeptoMail unreachable: ${(err as Error).message}` };
  }

  const json = (await res.json().catch(() => null)) as
    | { data?: Array<{ message_id?: string }>; message?: string; error?: { message?: string; details?: unknown } }
    | null;

  if (!res.ok) {
    const reason = json?.error?.message ?? json?.message ?? `HTTP ${res.status}`;
    return { ok: false, error: reason };
  }

  return { ok: true, id: json?.data?.[0]?.message_id };
}
