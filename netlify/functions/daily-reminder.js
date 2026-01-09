const { schedule } = require('@netlify/functions');
const nodemailer = require('nodemailer');
const turnos = require('./turnos_db');

const handler = async function (event, context) {
    console.log("⏰ Ejecutando cron job de recordatorios...");

    // Configuración: Zona Horaria y Fechas
    // Simulamos hora local de El Salvador (UTC-6)
    const now = new Date();
    // Ajuste simple para obtener fecha actual en CST
    const cstOffset = -6 * 60; // offset en minutos
    const localNow = new Date(now.getTime() + (cstOffset * 60 * 1000));

    // Queremos revisar los próximos 3 días
    // Buscar el PRÓXIMO turno en la lista
    // Convertir lista de strings a objetos Date
    const upcomingShifts = turnos
        .map(t => new Date(t + "T09:00:00")) // Asumir 9 AM para comparación
        .filter(d => d > localNow)
        .sort((a, b) => a - b);

    if (upcomingShifts.length === 0) {
        return { statusCode: 200, body: "No hay turnos futuros." };
    }

    const nextShift = upcomingShifts[0]; // El más cercano

    // Calcular diferencia en días (redondeado hacia arriba para que "mañana" sea 1)
    const diffTime = nextShift - localNow;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) - 1;
    // Nota: Si es hoy, diffTime es pequeño, ceil es 1, -1 es 0.
    // Si es mañana, ceil es 2, -1 es 1.

    // Ajuste más preciso de días naturales:
    const todayStr = localNow.toISOString().split('T')[0];
    const shiftStr = nextShift.toISOString().split('T')[0];

    const d1 = new Date(todayStr);
    const d2 = new Date(shiftStr);
    const diffTimeDays = d2 - d1;
    const naturalDiffDays = Math.ceil(diffTimeDays / (1000 * 60 * 60 * 24));

    console.log(`🔎 Próximo turno detectado: ${shiftStr}`);
    console.log(`⏳ Faltan ${naturalDiffDays} días naturales.`);

    // LÓGICA DE NOTIFICACIÓN (3, 2, 1 días antes, y el mismo día)
    if (naturalDiffDays <= 3 && naturalDiffDays >= 0) {

        let message = "";
        let subject = "";

        if (naturalDiffDays === 3) {
            subject = "📅 Faltan 3 días para tu turno";
            message = "¡Hola! Ten presente que en 3 días tienes turno. Ve organizando tu semana. 😊";
        } else if (naturalDiffDays === 2) {
            subject = "📅 Faltan 2 días para tu turno";
            message = "Solo faltan 2 días para tu turno en TCS. ¡Ánimo!";
        } else if (naturalDiffDays === 1) {
            subject = "⏰ ¡Mañana es tu turno!";
            message = "Recuerda que mañana tienes turno. ¡Descansa bien hoy! 😴";
        } else if (naturalDiffDays === 0) {
            subject = "🚨 ¡Hoy es tu turno!";
            message = "¡Éxito en tu turno de hoy! Tú puedes. 💪";
        }

        console.log(`✅ Enviando alerta: ${subject}`);
        await sendNotification(shiftStr, subject, message);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Notificación enviada", type: subject })
        };
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ message: "Aún no es tiempo de alertar.", daysLeft: naturalDiffDays })
    };
};

async function sendNotification(dateStr, subject, textBody) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const destEmail = process.env.BERE_EMAIL;

    // HTML Bonito
    const htmlContent = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; text-align: center; background-color: #f0f2f5;">
            <div style="background: white; padding: 40px; border-radius: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); max-width: 500px; margin: auto;">
                <h2 style="color: #FF6B6B; margin-top: 0;">${subject}</h2>
                <div style="font-size: 40px; margin: 20px 0;">📅</div>
                <p style="font-size: 18px; color: #4a5568; line-height: 1.6;">${textBody}</p>
                <p style="color: #cbd5e0; font-size: 14px; margin-top: 30px;">Turno programado: <strong>${dateStr}</strong></p>
                <br>
                <a href="https://calendario-berenice.netlify.app" style="background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); color: white; padding: 12px 25px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(255, 107, 107, 0.3);">Ver Calendario</a>
            </div>
            <p style="color: #a0aec0; font-size: 12px; margin-top: 20px;">Recordatorio automático enviado con ❤️</p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: `"Antigravity Calendar" <${process.env.EMAIL_USER}>`,
            to: destEmail,
            subject: subject,
            html: htmlContent
        });
        console.log("📧 Email enviado correctamente");
    } catch (error) {
        console.error("❌ Error enviando email:", error);
    }
}

// Ejecutar 2 veces al día: 8:00 AM y 6:00 PM (14:00 y 00:00 UTC)
module.exports.handler = schedule("0 14,0 * * *", handler);
