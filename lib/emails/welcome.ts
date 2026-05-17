/**
 * Genera el HTML del email de bienvenida para un nuevo cliente de NutriCoach.
 */
export function welcomeEmailHtml(nombre: string, appUrl: string): string {
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
              <p style="color:#dcfce7; font-size:14px; margin:8px 0 0 0; opacity:0.9;">Tu plan nutricional personalizado</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 24px;">
              <h2 style="color:#09090b; font-size:20px; margin:0 0 16px 0;">¡Bienvenido, ${nombre}!</h2>
              <p style="color:#3f3f46; font-size:15px; line-height:1.6; margin:0 0 16px 0;">
                Tu cuenta en <strong>NutriCoach</strong> ha sido creada correctamente. Ya puedes acceder a tu portal personal donde encontrarás:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:8px 0;">
                    <span style="color:#22c55e; font-size:18px; margin-right:8px;">✓</span>
                    <span style="color:#3f3f46; font-size:14px;">Tu plan de dieta personalizado</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;">
                    <span style="color:#22c55e; font-size:18px; margin-right:8px;">✓</span>
                    <span style="color:#3f3f46; font-size:14px;">Recetas adaptadas a tus objetivos</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;">
                    <span style="color:#22c55e; font-size:18px; margin-right:8px;">✓</span>
                    <span style="color:#3f3f46; font-size:14px;">Lista de la compra inteligente</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;">
                    <span style="color:#22c55e; font-size:18px; margin-right:8px;">✓</span>
                    <span style="color:#3f3f46; font-size:14px;">Seguimiento de tu progreso semanal</span>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:24px 0 0 0;" align="center">
                    <a href="${appUrl}/onboarding"
                       style="display:inline-block; background-color:#22c55e; color:#ffffff; text-decoration:none; font-size:15px; font-weight:600; padding:14px 32px; border-radius:8px; text-align:center;">
                      Completar mi perfil
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color:#a1a1aa; font-size:13px; line-height:1.5; margin:24px 0 0 0; text-align:center;">
                Si tienes cualquier duda, contacta con tu coach directamente.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 24px; background-color:#fafafa; border-top:1px solid #e4e4e7;">
              <p style="color:#a1a1aa; font-size:12px; margin:0; text-align:center;">
                NutriCoach &mdash; Tu coach nutricional de confianza<br />
                <a href="${appUrl}" style="color:#22c55e; text-decoration:none;">${appUrl}</a>
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

/**
 * Envía el email de bienvenida usando Resend.
 * No lanza error si falla — solo loggea.
 */
export async function sendWelcomeEmail(params: {
    to: string
    nombre: string
    appUrl: string
}): Promise<void> {
    const { Resend } = await import('resend')
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
        console.warn('[sendWelcomeEmail] RESEND_API_KEY no configurada — email no enviado')
        return
    }

    const resend = new Resend(apiKey)
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
    const fromName = process.env.RESEND_FROM_NAME ?? 'NutriCoach'

    try {
        await resend.emails.send({
            from: `${fromName} <${fromEmail}>`,
            to: params.to,
            subject: '¡Bienvenido a NutriCoach! 🏋️',
            html: welcomeEmailHtml(params.nombre, params.appUrl),
        })
        console.log(`[sendWelcomeEmail] ✅ Bienvenida enviada a ${params.to}`)
    } catch (err) {
        console.error('[sendWelcomeEmail] Error al enviar email:', err)
        // No propagamos el error — el registro debe funcionar aunque el email falle
    }
}
