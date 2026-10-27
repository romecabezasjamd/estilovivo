// Política de privacidad y condiciones de uso: texto ÚNICO. El servidor los sirve como páginas públicas /privacidad
// y /condiciones (sin JavaScript; la primera es la URL que se da a Google Play) y los copian la app
// (PremiumPrivacyScreens.kt, LegalScreens) y la web (pages/Privacy.tsx, pages/Terms.tsx). Si cambias algo aquí, cámbialo también allí.
//
// Los datos del responsable NO van en el código (el repositorio es público): salen de la variable de entorno
// DATA_CONTROLLER (p. ej. "Nombre Apellidos, DNI 00000000X, dirección"), que se edita en Coolify.

export const POLICY_UPDATED = '27 de octubre de 2026';

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
        'Seguridad: denuncias y bloqueos que hagas o recibas, las decisiones de moderación sobre tu cuenta o tu contenido y, si el sistema bloquea una foto que intentas subir, un registro sin la foto (cuándo, en qué parte de la app y la puntuación del análisis).',
        'Informes de error: si la app se cierra o la web falla, se envía un informe técnico (versión, modelo de móvil o navegador y el error) para poder arreglarlo. No incluye el contenido de tu cuenta.',
        'Solicitudes de privacidad: lo que nos pidas desde Mis derechos de privacidad y nuestra respuesta.',
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
        'Tablero de Tendencias: si tu perfil es público y eres mayor de edad, tus looks públicos más queridos pueden aparecer en el tablero de la semana y en la inspiración de otras personas, con tu nombre y enlace a tu perfil (interés legítimo en mostrar lo que se lleva en la comunidad). Nunca se muestran looks de menores. Puedes oponerte cuando quieras desactivando Perfil › Ajustes › Mostrar mis looks en Tendencias.',
        'Fotos de inspiración de Unsplash en Tendencias: solo se cargan si pulsas "Ver fotos de Unsplash" (y puedes dejar de verlas cuando quieras). Entonces tu dispositivo descarga las fotos directamente de Unsplash, que recibe tu dirección IP y cuenta las visualizaciones con un identificador aleatorio. Nosotros no le enviamos ningún dato de tu cuenta: las búsquedas las hace nuestro servidor solo con palabras de moda (tu consentimiento, al pulsar el botón).',
        'Ideas con esta prenda: para sugerirte combinaciones, nuestro servidor compara la prenda con las demás de tu armario (tipo y color) en el momento en que lo pides. Solo lo ves tú, no se guarda ningún perfil y no se usa ningún servicio externo ni de inteligencia artificial (ejecución del contrato). En "Recrea este look" se usa solo la palabra de moda con la que se buscó la foto de inspiración: no se analiza la imagen ni a la persona que sale en ella.',
        'Enviarte avisos al móvil y por correo: tu consentimiento, que puedes retirar en Perfil › Ajustes o en los ajustes del móvil.',
        'Aviso "Tu look de hoy" cada mañana: solo llega si has dado permiso de notificaciones al móvil (tu consentimiento) y lo puedes desactivar cuando quieras en Perfil › Ajustes › Avisos en el móvil o en los ajustes de Android. Lo genera el propio móvil, sin enviar nada a nuestros servidores, y no contiene publicidad.',
        'Usar la cámara, la galería y la ubicación: solo con tu permiso y para la función que estás usando.',
        'Mantener la plataforma segura y revisar denuncias: interés legítimo en proteger a la comunidad. Las denuncias las revisa una persona del equipo con permiso de administración, que puede retirar contenido, anular participaciones en retos o suspender cuentas. Si te afecta, te explicamos el motivo y cómo reclamar (Reglamento de Servicios Digitales de la UE). Cada acción queda registrada.',
        'Avisos del servicio a todas las cuentas (mantenimiento, cambios de normas o de esta política): ejecución del contrato. Nunca los usamos para publicidad.',
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
        'Unsplash (Unsplash Inc.): sirve las fotos de inspiración de Tendencias si eliges verlas. Recibe tu dirección IP y datos técnicos de la visualización, que trata como responsable independiente según su propia política de privacidad (unsplash.com/privacy).',
        'UI Avatars: genera una imagen con tus iniciales si no tienes foto de perfil (recibe tu nombre visible).',
        'Google ML Kit: recorta las prendas y detecta la pose en tu propio dispositivo; las fotos no se envían a Google para esto.',
        'Las demás personas usuarias ven lo que publicas según tu configuración de privacidad.',
      ],
    },
    {
      title: '5. Transferencias fuera del Espacio Económico Europeo',
      paragraphs: ['Algunos proveedores (Google, Cloudflare y, si eliges ver sus fotos, Unsplash) pueden tratar datos fuera del EEE. Lo hacen con las garantías que exige el RGPD, como las cláusulas contractuales tipo de la Comisión Europea.'],
    },
    {
      title: '6. Cuánto tiempo los conservamos',
      paragraphs: [
        'Mientras tu cuenta esté activa. Si la eliminas, borramos tu perfil, tus prendas, looks, historias, comentarios, me gusta, mensajes enviados, notificaciones y dispositivos registrados.',
        'Registros técnicos y de seguridad: los informes de error y los registros de fotos bloqueadas se borran a los 90 días. Las decisiones de moderación y las solicitudes de privacidad se guardan 3 años para poder demostrar que se atendieron correctamente.',
        'Se conservan el contenido de otras personas (por ejemplo, los mensajes que te enviaron) y las denuncias que hayas presentado, sin tus datos de perfil, para poder revisarlas. Las copias de seguridad técnicas se sustituyen de forma rotativa y tus datos desaparecen de ellas al rotarse.',
      ],
    },
    {
      title: '7. Tus derechos',
      bullets: [
        'Acceso y portabilidad: Perfil › Ajustes › Descargar mis datos (archivo JSON).',
        'Rectificación: Perfil › Editar perfil.',
        'Supresión: Perfil › Ajustes › Eliminar mi cuenta, o la página pública de eliminación de cuenta.',
        'Oposición, limitación, retirada del consentimiento o cualquier otra petición: Perfil › Ajustes › Mis derechos de privacidad, o escríbenos al correo de contacto. Respondemos en un mes como máximo.',
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
      title: '10. Cookies y almacenamiento en tu dispositivo',
      paragraphs: [
        'Solo usamos lo técnicamente necesario para que la web y la app funcionen: una cookie de sesión segura para mantenerte conectada y el almacenamiento del navegador o del móvil para recordar tus preferencias (tema, idioma) y guardar copias temporales que aceleran la carga.',
        'No usamos cookies de analítica, de publicidad ni de seguimiento, propias ni de terceros. Por eso no te pedimos aceptar cookies: las estrictamente necesarias están exentas de consentimiento (artículo 22.2 de la LSSI). Si las borras desde tu navegador, tendrás que volver a iniciar sesión.',
        'Las fotos de inspiración de Unsplash no se cargan hasta que lo eliges con el botón "Ver fotos de Unsplash"; tu elección se guarda en tu dispositivo y puedes retirarla con "Dejar de verlas".',
      ],
    },
    {
      title: '11. Cambios en esta política',
      paragraphs: ['Si cambiamos algo importante, lo indicaremos en la app y actualizaremos la fecha de esta página.'],
    },
  ];
}

// ============= CONDICIONES DE USO Y NORMAS DE LA COMUNIDAD =============
export const TERMS_UPDATED = '27 de octubre de 2026';

export function termsSections(owner: string, email: string): PolicySection[] {
  return [
    {
      title: '1. Quién presta el servicio',
      paragraphs: [
        `Estilo Vivo es un servicio gratuito ofrecido por ${owner}.`,
        `Contacto: ${email}. Puedes escribirnos en español o en inglés.`,
      ],
    },
    {
      title: '2. Aceptación y edad mínima',
      paragraphs: [
        'Al crear una cuenta aceptas estas condiciones y la política de privacidad. Si no estás de acuerdo, no uses Estilo Vivo.',
        'Debes tener al menos 14 años. Entre los 14 y los 17 años tu perfil es privado por defecto, solo puedes chatear con personas con las que os seguís mutuamente y, para comprar o vender, necesitas la autorización de un adulto responsable desde la app.',
      ],
    },
    {
      title: '3. Tu cuenta',
      bullets: [
        'Usa datos reales y una sola cuenta por persona. Tu cuenta es personal: no la compartas ni la vendas.',
        'Cuida tu contraseña. Eres responsable de lo que se haga desde tu cuenta.',
        'Puedes eliminar tu cuenta cuando quieras desde Perfil › Ajustes.',
      ],
    },
    {
      title: '4. Normas de la comunidad',
      paragraphs: ['No está permitido publicar, enviar ni vender:'],
      bullets: [
        'Desnudos, contenido sexual o fotos íntimas. El contenido que sexualice a menores se denuncia a las autoridades (ver las normas de seguridad infantil en estilovivo.xyoncloud.win/seguridad-infantil).',
        'Acoso, insultos, amenazas, discursos de odio o contenido violento.',
        'Suplantar a otra persona o marca, o publicar datos personales de otras personas sin su permiso.',
        'Fotos que no son tuyas o de las que no tienes permiso (derechos de autor y derecho a la propia imagen).',
        'Spam, publicidad no autorizada o enlaces para llevar a otras tiendas.',
        'Falsificaciones, artículos robados, armas, drogas, alcohol, tabaco, medicamentos, animales o cualquier producto ilegal.',
        'Engaños o estafas.',
      ],
    },
    {
      title: '5. Compraventa entre particulares',
      bullets: [
        'La tienda es solo para que particulares vendan su propia ropa y accesorios. No está permitido vender como profesional o empresa: antes de tu primera venta confirmas que vendes como particular, y los anuncios lo indican.',
        'Estilo Vivo solo pone en contacto a quien vende y a quien compra. No es parte de la venta, no cobra comisiones y no gestiona pagos ni envíos.',
        'Cada persona es responsable de lo que anuncia y de lo que acuerda: precio, estado real de la prenda, entrega y, en su caso, devoluciones. Estilo Vivo no realiza reembolsos de estas ventas porque no recibe el dinero.',
        'Al comprar a un particular no se aplican el derecho de desistimiento ni la garantía legal que la ley de consumidores da en las compras a empresas.',
        'Los anuncios aparecen del más reciente al más antiguo y puedes filtrarlos por categoría o buscarlos. No hay anuncios patrocinados ni posiciones de pago.',
        'Cada anuncio necesita un precio entre 0 y 10.000 €. Las personas de 14 a 17 años solo pueden vender o comprar con la autorización de su adulto responsable.',
        'Recomendaciones: quedad en un lugar público, revisad la prenda antes de pagar y no adelantéis dinero a personas desconocidas.',
        'Puedes denunciar un anuncio desde su ficha. Lo revisaremos y, si incumple estas normas o la ley, lo retiraremos de la venta y avisaremos a quien lo publicó.',
      ],
    },
    {
      title: '6. Premium',
      paragraphs: [
        'Durante la beta, todas las funciones son gratuitas y no hay pagos dentro de la app. Si en el futuro hubiera funciones de pago, te avisaríamos antes; se cobrarían a través de Google Play y se aplicaría su política de reembolsos.',
      ],
    },
    {
      title: '7. Tu contenido',
      paragraphs: [
        'Lo que subes sigue siendo tuyo. Nos das permiso, gratuito y no exclusivo, para guardarlo y mostrarlo dentro de Estilo Vivo según tu configuración de privacidad, solo mientras lo mantengas publicado. Si lo borras, deja de mostrarse.',
      ],
    },
    {
      title: '8. Moderación y cómo reclamar',
      bullets: [
        'Cada foto que subes la revisa un sistema automático que bloquea desnudos y contenido sexual.',
        'Las denuncias las revisa una persona del equipo. Si algo incumple estas normas o la ley, podemos retirarlo, anular una participación en un reto o suspender la cuenta. Quien repita infracciones puede perder la cuenta.',
        'Si una decisión te afecta, te explicamos el motivo. Puedes reclamar en los 6 meses siguientes respondiendo al correo o escribiéndonos; otra persona lo revisará de nuevo. También puedes acudir a un órgano de resolución extrajudicial certificado o a los tribunales.',
        `Cualquier persona, aunque no tenga cuenta, puede avisarnos de contenido ilegal escribiendo a ${email} con el enlace o la descripción y el motivo.`,
      ],
    },
    {
      title: '9. Funciones orientativas y enlaces a otras webs',
      paragraphs: [
        'El probador virtual superpone la prenda sobre tu foto para darte una idea; no es una representación exacta de la talla ni del ajuste. Las sugerencias de looks según el tiempo o el ánimo son orientativas.',
        'En Tendencias mostramos titulares de revistas y webs de moda con un enlace a su artículo. Esos titulares, artículos y marcas pertenecen a cada publicación, que no tiene relación con Estilo Vivo; al pulsar se abre su web, con sus propias condiciones y política de privacidad. El tablero de la semana y "Lo que se lleva" se hacen solo con los looks públicos de personas adultas de la comunidad (quien no quiera aparecer puede desactivarlo en sus ajustes), con colores y palabras propias; no usan fotos de revistas ni marcas. Si eliges verlas, también mostramos fotos libres de Unsplash buscadas con esas palabras: cada una pertenece a su fotógrafo, se ofrece bajo la licencia de Unsplash y aparece con su crédito y enlace. No implican que el fotógrafo, las personas que salen ni las marcas que se vean recomienden Estilo Vivo.',
        'Las ideas con una prenda de tu armario son sugerencias orientativas. Las prendas dibujadas son solo ilustraciones de lo que podría combinar; no son productos a la venta ni recomendaciones de ninguna marca. "Recrea este look" se inspira en la tendencia de la foto, no copia la prenda concreta que aparece en ella.',
      ],
    },
    {
      title: '10. Responsabilidad',
      paragraphs: [
        'Intentamos que Estilo Vivo funcione siempre bien, pero puede haber interrupciones o errores. No respondemos del contenido que publican otras personas ni de los acuerdos entre ellas, salvo en lo que exija la ley. Nada de estas condiciones limita tus derechos como persona consumidora.',
      ],
    },
    {
      title: '11. Cambios y fin del servicio',
      paragraphs: [
        'Si cambiamos estas condiciones de forma importante, te avisaremos en la app antes de que se apliquen. Si algún día cerramos Estilo Vivo, avisaremos con antelación para que puedas descargar tus datos.',
      ],
    },
    {
      title: '12. Ley aplicable',
      paragraphs: [
        'Se aplica la ley española. Si eres consumidora, puedes reclamar ante los juzgados de tu domicilio.',
      ],
    },
  ];
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Página pública sin JavaScript. El correo va entre email_off para que Cloudflare no lo ofusque. */
export function renderPolicyPage(controller: string, email: string): string {
  return renderLegalPage('Política de privacidad', 'Política de <em>privacidad</em>', POLICY_UPDATED, policySections(controller, email), email);
}

export function renderTermsPage(owner: string, email: string): string {
  return renderLegalPage('Condiciones de uso', 'Condiciones de <em>uso</em>', TERMS_UPDATED, termsSections(owner, email), email);
}

function renderLegalPage(title: string, headline: string, updated: string, sections: PolicySection[], email: string): string {
  const mail = (t: string) =>
    esc(t).replace(esc(email), `<!--email_off--><a href="mailto:${esc(email)}">${esc(email)}</a><!--/email_off-->`);
  const body = sections
    .map(
      (s) => `<section><h2>${esc(s.title)}</h2>${(s.paragraphs || []).map((p) => `<p>${mail(p)}</p>`).join('')}${
        s.bullets?.length ? `<ul>${s.bullets.map((b) => `<li>${mail(b)}</li>`).join('')}</ul>` : ''
      }</section>`,
    )
    .join('');
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Estilo Vivo</title>
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
<h1>${headline}</h1>
<p class="updated">Última actualización: ${updated}</p>
${body}
<p class="foot"><a href="/privacidad">Privacidad</a> · <a href="/condiciones">Condiciones de uso</a> · <a href="/eliminar-cuenta">Eliminar tu cuenta</a> · <a href="/">estilovivo.xyoncloud.win</a></p>
</main></body></html>`;
}

// ============= NORMAS DE SEGURIDAD INFANTIL =============
// Google Play exige a las apps sociales publicar sus normas contra el abuso y la explotación sexual infantil (CSAE)
// y tener un punto de contacto. Estilo Vivo admite cuentas desde los 14 años, con protecciones para menores.
export const CHILD_SAFETY_UPDATED = '27 de octubre de 2026';

export function childSafetySections(email: string): PolicySection[] {
  return [
    {
      title: '1. Tolerancia cero',
      paragraphs: [
        'En Estilo Vivo está totalmente prohibido cualquier contenido o conducta de abuso o explotación sexual infantil: imágenes o vídeos de menores con contenido sexual, sexualizar a menores, el acoso con fines sexuales (grooming), pedir fotos íntimas, la sextorsión o cualquier intento de contactar con menores con esa intención.',
        'La cuenta que lo haga se elimina de inmediato y no puede volver a registrarse.',
      ],
    },
    {
      title: '2. Cómo protegemos a las personas menores',
      bullets: [
        'Edad mínima de 14 años y fecha de nacimiento obligatoria al registrarse.',
        'Entre 14 y 17 años el perfil es privado por defecto y solo se puede chatear con personas con las que hay seguimiento mutuo.',
        'Para comprar o vender, una persona menor necesita la autorización de un adulto responsable desde la app.',
        'Los looks de menores nunca salen en el tablero de Tendencias ni en la inspiración de otras personas.',
        'Cada foto que se sube la revisa un sistema automático que bloquea desnudos y contenido sexual antes de publicarse.',
      ],
    },
    {
      title: '3. Cómo denunciar',
      bullets: [
        'Desde la app: en cualquier perfil, look, comentario, mensaje o anuncio, con la opción "Denunciar". También puedes bloquear a la persona.',
        `Por correo, tengas o no cuenta: ${email}, con el enlace o la descripción del contenido. Las denuncias sobre menores se revisan con prioridad.`,
        'Si alguien corre peligro, avisa también a la policía (112) o a la línea de ayuda a la infancia de la Fundación ANAR (900 20 20 10).',
      ],
    },
    {
      title: '4. Qué hacemos',
      paragraphs: [
        'Retiramos el contenido, eliminamos la cuenta y conservamos las pruebas necesarias. El material de abuso sexual infantil se denuncia a las autoridades competentes (Policía Nacional o Guardia Civil) y colaboramos con ellas según la ley.',
      ],
    },
    {
      title: '5. Punto de contacto',
      paragraphs: [`Persona responsable de estas normas y contacto para autoridades y usuarios: ${email}. Puedes escribirnos en español o en inglés.`],
    },
  ];
}

export function renderChildSafetyPage(email: string): string {
  return renderLegalPage('Normas de seguridad infantil', 'Seguridad <em>infantil</em>', CHILD_SAFETY_UPDATED, childSafetySections(email), email);
}
