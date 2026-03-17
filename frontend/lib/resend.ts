import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendWelcomeEmail(email: string, name: string) {
  return resend.emails.send({
    from: "Draftly <welcome@draftly.biz>",
    to: [email],
    subject: "Welcome to Draftly — let's build your proposal moat",
    html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
  <h1 style="color:#00BFA5;">Welcome to Draftly, ${name}!</h1>
  <p>You're now building your Context-Mapper — the institutional memory that makes your proposals impossible to replicate.</p>
  <p>Start by uploading 5 past proposals. Each one deepens your moat.</p>
  <a href="https://app.draftly.biz/onboarding"
     style="background:#00BFA5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0;">
    Complete Your Onboarding →
  </a>
  <p style="color:#666;font-size:12px;">Results you can measure, stories worth telling.</p>
</div>`,
  });
}
