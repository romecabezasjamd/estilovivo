// Política de privacidad: texto ÚNICO. Lo sirve el servidor como página pública /privacidad (sin JavaScript, la URL
// que se da a Google Play) y lo copian la app (PremiumPrivacyScreens.kt) y la web (pages/Privacy.tsx).
// Si cambias algo aquí, cámbialo también allí.
//
// Los datos del responsable NO van en el código (el repositorio es público): salen de la variable de entorno
// DATA_CONTROLLER (p. ej. "Nombre Apellidos, DNI 00000000X, dirección"), que se edita en Coolify.

export const POLICY_UPDATED = '20 de octubre de 2026';

export interface PolicySection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}

export function policySections(controller: string, email: string): PolicySection[] {
  return [
    {
      title: '1. Quién es el responsable',
      paragraphs: [
        `Responsable del tratamiento: ${controller}.`,
        `Contacto para cualquier cuestión de privacidad: ${email}.`,
      ],
    },
    {
      title: '2. Qué datos tratamos',
      bullets: [
        'Cuenta: nombre, correo electrónico, contraseña (guardada con un hash irreversible), fecha de nacimiento y género.',
        'Perfil: foto de perfil, foto de cuerpo entero (para el probador), biografía, ciudad para el tiempo y preferencias de estilo y de la app.',
        'Lo que publicas y haces: prendas, looks, fotos, historias, comentarios, me gusta, favoritos, seguidores, participaciones en retos, planificador, maletas y mensajes de chat.',
        'Avisos: un identificador del dispositivo para enviarte notificaciones al móvil, y tus preferencias de avisos por correo.',
        'Seguridad: denuncias y bloqueos que hagas o recibas.',
        'Informes de error: si la app se cierra por un fallo, al abrirla se envía un informe técnico (versión de la app y de Android, modelo de móvil y el error) para poder arreglarlo. No incluye el contenido de tu cuenta.',
        'Menores de edad: si tienes entre 14 y 17 años, el vínculo con tu adulto responsable (su cuenta y si te autoriza a comprar y vender).',
        'Ubicación aproximada: solo si das permiso, y únicamente para consultar el tiempo en ese momento; no la guardamos.',
        'Ciclo menstrual (opcional): se guarda cifrado solo en tu dispositivo y nunca se envía a nuestros servidores.',
      ],
    },
    {
      title: '3. Para qué los usamos y con qué base legal',
      bullets: [
        'Prestarte el servicio (armario, looks, probador, comunidad y chat): ejecución del contrato que aceptas al registrarte.',
        'Mostrar tu contenido a otras personas según tu configuración de privacidad (perfil público o privado).',
        'Enviarte avisos al móvil y por correo: tu consentimiento, que puedes retirar en Perfil › Ajustes o en los ajustes del móvil.',
        'Usar la cámara, la galería y la ubicación: solo con tu permiso y para la función que estás usando.',
        'Mantener la plataforma segura y revisar denuncias: interés legítimo en proteger a la comunidad.',
        'Arreglar errores de la app con los informes técnicos: interés legítimo en que la app funcione bien.',
        'Revisión automática de fotos: cada foto que subes se analiza en nuestro propio servidor con un sistema automático para bloquear desnudos y contenido sexual. La foto no se envía a terceros; si se bloquea, se borra al instante y no se guarda. Si crees que es un error, escríbenos (interés legítimo y protección de menores).',
        'Fecha de nacimiento: para comprobar la edad mínima y aplicar las protecciones de menores (cumplimiento legal e interés legítimo). No se muestra a otras personas.',
        'Cumplir obligaciones legales.',
        'No vendemos tus datos, no mostramos publicidad y no usamos herramientas de analítica ni de seguimiento de terceros.',
      ],
    },
    {
      title: '4. Con quién se comparten',
      paragraphs: ['Solo con los proveedores necesarios para que la app funcione, y solo lo imprescindible:'],
      bullets: [
        'Alojamiento del servidor donde se guardan tus datos, contratado por el responsable.',
        'Cloudflare: red que protege y acelera el acceso a la web y a la app.',
        'Google Firebase Cloud Messaging: entrega las notificaciones al móvil (recibe el identificador del dispositivo y el texto del aviso).',
        'Google (Gmail): envía los correos de la cuenta y de avisos.',
        'Open-Meteo: devuelve el tiempo para tu zona (recibe la ciudad o una ubicación aproximada, sin tus datos de cuenta).',
        'UI Avatars: genera una imagen con tus iniciales si no tienes foto de perfil (recibe tu nombre visible).',
        'Google ML Kit: recorta las prendas y detecta la pose en tu propio dispositivo; las fotos no se envían a Google para esto.',
        'Las demás personas usuarias ven lo que publicas según tu configuración de privacidad.',
      ],
    },
    {
      title: '5. Transferencias fuera del Espacio Económico Europeo',
      paragraphs: ['Algunos proveedores (Google, Cloudflare) pueden tratar datos fuera del EEE. Lo hacen con las garantías que exige el RGPD, como las cláusulas contractuales tipo de la Comisión Europea.'],
    },
    {
      title: '6. Cuánto tiempo los conservamos',
      paragraphs: [
        'Mientras tu cuenta esté activa. Si la eliminas, borramos tu perfil, tus prendas, looks, historias, comentarios, me gusta, mensajes enviados, notificaciones y dispositivos registrados.',
        'Se conservan el contenido de otras personas (por ejemplo, los mensajes que te enviaron) y las denuncias que hayas presentado, sin tus datos de perfil, para poder revisarlas. Las copias de seguridad técnicas se sustituyen de forma rotativa y tus datos desaparecen de ellas al rotarse.',
      ],
    },
    {
      title: '7. Tus derechos',
      bullets: [
        'Acceso y portabilidad: Perfil › Ajustes › Descargar mis datos (archivo JSON).',
        'Rectificación: Perfil › Editar perfil.',
        'Supresión: Perfil › Ajustes › Eliminar mi cuenta, o la página pública de eliminación de cuenta.',
        'Oposición, limitación y retirada del consentimiento: escríbenos al correo de contacto.',
        'Si crees que no hemos tratado bien tus datos, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).',
      ],
    },
    {
      title: '8. Edad mínima',
      paragraphs: [
        'Debes tener al menos 14 años para usar Estilo Vivo (en España, desde esa edad puedes consentir el tratamiento de tus datos: artículo 7 de la LOPDGDD). Si detectamos una cuenta de una persona menor de esa edad, la eliminaremos.',
        'Si tienes entre 14 y 17 años: tu perfil es privado por defecto, solo puedes chatear con personas con las que os seguís mutuamente, y para comprar o vender necesitas que un adulto responsable (madre, padre, tutor o familiar mayor de edad con cuenta propia) lo autorice desde la app. Ese adulto puede retirar el permiso en cualquier momento.',
      ],
    },
    {
      title: '9. Seguridad',
      paragraphs: ['Toda la comunicación va cifrada (HTTPS). Las contraseñas se guardan con un hash irreversible y la sesión de la app se guarda cifrada en tu dispositivo. Las claves del servidor no están en el código.'],
    },
    {
      title: '10. Cambios en esta política',
      paragraphs: ['Si cambiamos algo importante, lo indicaremos en la app y actualizaremos la fecha de esta página.'],
    },
  ];
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Página pública sin JavaScript. El correo va entre email_off para que Cloudflare no lo ofusque. */
export function renderPolicyPage(controller: string, email: string): string {
  const mail = (t: string) =>
    esc(t).replace(esc(email), `<!--email_off--><a href="mailto:${esc(email)}">${esc(email)}</a><!--/email_off-->`);
  const body = policySections(controller, email)
    .map(
      (s) => `<section><h2>${esc(s.title)}</h2>${(s.paragraphs || []).map((p) => `<p>${mail(p)}</p>`).join('')}${
        s.bullets?.length ? `<ul>${s.bullets.map((b) => `<li>${mail(b)}</li>`).join('')}</ul>` : ''
      }</section>`,
    )
    .join('');
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Política de privacidad · Estilo Vivo</title>
<style>
body{margin:0;background:#F2F2F4;color:#0F0F12;font-family:'Poppins','Helvetica Neue',Helvetica,Arial,sans-serif;line-height:1.65}
main{max-width:720px;margin:0 auto;padding:36px 18px 56px}
.brand{font-weight:700;font-size:20px;margin-bottom:22px}.brand em,h1 em{font-family:'Instrument Serif',Georgia,serif;font-weight:400}
h1{font-size:34px;line-height:1.15;margin:0 0 6px;letter-spacing:-.5px}h1 em{color:#E84393}
.updated{color:#8A8A96;font-size:14px;margin:0 0 22px}
section{background:#fff;border-radius:24px;padding:18px 22px;margin:12px 0}
h2{font-size:18px;margin:0 0 6px}p,li{color:#4A4A55;font-size:15px}ul{padding-left:20px;margin:6px 0}li{margin:4px 0}
a{color:#0F0F12}.foot{text-align:center;color:#8A8A96;font-size:13px;margin-top:24px}
</style></head><body><main>
<div class="brand">Estilo <em>Vivo</em></div>
<h1>Política de <em>privacidad</em></h1>
<p class="updated">Última actualización: ${POLICY_UPDATED}</p>
${body}
<p class="foot"><a href="/eliminar-cuenta">Eliminar tu cuenta</a> · <a href="/">estilovivo.xyoncloud.win</a></p>
</main></body></html>`;
}
