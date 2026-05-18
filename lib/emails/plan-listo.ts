export function planListoEmailHtml(nombre: string, portalUrl: string): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5; padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg, #22c55e, #16a34a); padding:32px 24px; text-align:center;">
              <h1 style="color:#ffffff; font-size:24px; margin:0; font-weight:700;">🏋️ NutriCoach</h1>
              <p style="color:#dcfce7; font-size:14px; margin:8px 0 0 0; opacity:0.9;">Tu plan personalizado está listo</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 24px;">
              <h2 style="color:#09090b; font-size:20px; margin:0 0 12px 0;">¡${nombre}, tu plan está listo! 🎉</h2>
              <p style="color:#3f3f46; font-size:15px; line-height:1.6; margin:0 0 20px 0;">
                Tu coach ha revisado tu perfil y ha preparado tu <strong>plan de nutrición y entrenamiento personalizado</strong>. Ya puedes verlo en tu portal.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4; border-radius:12px; padding:16px; margin-bottom:24px;">
                <tr><td style="padding:6px 0;"><span style="color:#16a34a; font-size:16px; margin-right:8px;">🥗</span><span style="color:#3f3f46; font-size:14px;">Plan de dieta con tus macros y comidas</span></td></tr>
                <tr><td style="padding:6px 0;"><span style="color:#16a34a; font-size:16px; margin-right:8px;">💪</span><span style="color:#3f3f46; font-size:14px;">Rutina de entrenamiento semanal</span></td></tr>
                <tr><td style="padding:6px 0;"><span style="color:#16a34a; font-size:16px; margin-right:8px;">📊</span><span style="color:#3f3f46; font-size:14px;">Seguimiento de progreso y check-ins</span></td></tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${portalUrl}"
                       style="display:inline-block; background-color:#22c55e; color:#ffffff; text-decoration:none; font-size:15px; font-weight:600; padding:14px 32px; border-radius:8px;">
                      Ver mi plan →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color:#a1a1aa; font-size:13px; line-height:1.5; margin:24px 0 0 0; text-align:center;">
                Si tienes dudas, contacta directamente con tu coach.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 24px; background-color:#fafafa; border-top:1px solid #e4e4e7;">
              <p style="color:#a1a1aa; font-size:12px; margin:0; text-align:center;">
                NutriCoach &mdash; Tu coach nutricional de confianza
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function sendPlanListoEmail(params: {
    to: string
    nombre: string
    appUrl: string
}): Promise<void> {
    const { Resend } = await import('resend')
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
        console.warn('[sendPlanListoEmail] RESEND_API_KEY no configurada — email no enviado')
        return
    }
    const resend = new Resend(apiKey)
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
    const fromName = process.env.RESEND_FROM_NAME ?? 'NutriCoach'
    const portalUrl = `${params.appUrl}/cliente`
    try {
        await resend.emails.send({
            from: `${fromName} <${fromEmail}>`,
            to: params.to,
            subject: '¡Tu plan nutricional está listo! 🎉',
            html: planListoEmailHtml(params.nombre, portalUrl),
        })
        console.log(`[sendPlanListoEmail] ✅ Email enviado a ${params.to}`)
    } catch (err) {
        console.error('[sendPlanListoEmail] Error al enviar email:', err)
    }
}
