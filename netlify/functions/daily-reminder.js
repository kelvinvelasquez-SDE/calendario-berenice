const { schedule } = require('@netlify/functions');
const nodemailer = require('nodemailer');
const turnos = require('./turnos_db');

const frases = [
    "📰 *Última hora:* Eres la periodista más hermosa del mundo.",
    "🎤 Reportando desde mi corazón: ¡Te amo muchísimo!",
    "📸 Tienes la primicia de mi vida entera.",
    "✍️ Tu mejor artículo es nuestra historia de amor.",
    "🌍 El mundo necesita noticias, pero yo solo te necesito a ti.",
    "🗞️ Titular de hoy: ¡Eres increíble y vas a brillar!",
    "📡 En vivo y en directo: ¡Te extraño y te pienso siempre!",
    "💭 Mi fuente más confiable me confirma que eres el amor de mi vida.",
    "📝 Eres la mejor editora de mis días felices.",
    "🌟 La noticia más bonita de mi día eres tú."
];

const handler = async function (event, context) {
    console.log("⏰ Ejecutando cron job romántico...");

    const now = new Date();
    const cstOffset = -6 * 60;
    const localNow = new Date(now.getTime() + (cstOffset * 60 * 1000));

    // Buscar el PRÓXIMO turno
    const upcomingShifts = turnos
        .map(t => new Date(t + "T09:00:00"))
        .filter(d => d > localNow)
        .sort((a, b) => a - b);

    if (upcomingShifts.length === 0) {
        return { statusCode: 200, body: "No hay turnos futuros." };
    }

    const nextShift = upcomingShifts[0];
    const shiftStr = nextShift.toISOString().split('T')[0];

    const d1 = new Date(localNow.toISOString().split('T')[0]);
    const d2 = new Date(shiftStr);
    const diffTimeDays = d2 - d1;
    const naturalDiffDays = Math.ceil(diffTimeDays / (1000 * 60 * 60 * 24));

    console.log(`🔎 Próximo turno: ${shiftStr} (Faltan ${naturalDiffDays} días)`);

    // SIEMPRE enviar correo (Cuenta Regresiva Diaria)
    // Seleccionar frase aleatoria
    const fraseDelDia = frases[Math.floor(Math.random() * frases.length)];

    let subject = "";
    if (naturalDiffDays === 0) subject = "🚨 ¡Hoy es tu turno, mi amor! ❤️";
    else if (naturalDiffDays === 1) subject = "⏰ ¡Mañana es tu turno hermosa!";
    else subject = `📅 Cuenta regresiva: Faltan ${naturalDiffDays} días`;

    await sendNotification(shiftStr, subject, naturalDiffDays, fraseDelDia);

    return {
        statusCode: 200,
        body: JSON.stringify({ message: "Notificación enviada", days: naturalDiffDays })
    };
};

async function sendNotification(dateStr, subject, daysLeft, phrase) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const destEmail = process.env.BERE_EMAIL;

    const htmlContent = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; text-align: center; background-color: #fff0f3;">
            <div style="background: white; padding: 40px; border-radius: 20px; box-shadow: 0 10px 25px rgba(255, 107, 107, 0.15); max-width: 500px; margin: auto; border-top: 5px solid #FF6B6B;">
                <h2 style="color: #FF6B6B; margin-top: 0; font-size: 24px;">${subject}</h2>
                
                <div style="font-size: 50px; margin: 20px 0;">🎙️👩‍💻</div>
                
                <p style="font-size: 18px; color: #555; font-style: italic; margin-bottom: 30px;">
                    "${phrase}"
                </p>

                <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin: 20px 0;">
                    <p style="margin: 0; color: #888; font-size: 14px;">Tu próximo turno es el:</p>
                    <p style="margin: 5px 0 0 0; color: #2C3E50; font-weight: bold; font-size: 20px;">${dateStr}</p>
                    <p style="margin-top: 5px; color: #FF6B6B; font-weight: bold;">(Faltan ${daysLeft} días)</p>
                </div>

                <br>
                <a href="https://calendario-berenice.netlify.app" style="background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 10px rgba(255, 107, 107, 0.3);">
                    Ver mi Calendario
                </a>
            </div>
            <p style="color: #dcb0b8; font-size: 12px; margin-top: 25px;">Hecho con amor para la mejor periodista 🗞️</p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: `"Tu fan #1 ❤️" <${process.env.EMAIL_USER}>`,
            to: destEmail,
            subject: subject,
            html: htmlContent
        });
        console.log("📧 Email romántico enviado correctamente");
    } catch (error) {
        console.error("❌ Error enviando email:", error);
    }
}

module.exports.handler = schedule("0 14,0 * * *", handler);
