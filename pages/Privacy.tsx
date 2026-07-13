import React from 'react'
import { ArrowLeft } from 'lucide-react'

interface Props {
  onBack: () => void
}

export default function Privacy({ onBack }: Props) {
  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: 'var(--border-light)' }}>
        <button onClick={onBack} className="p-1 rounded-lg"><ArrowLeft size={20} style={{ color: 'var(--text-primary)' }} /></button>
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Politica de Privacidad</h1>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Ultima actualizacion: julio 2026</p>

        <section>
          <h2 className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>1. Informacion que recopilamos</h2>
          <p>Recopilamos la informacion que nos proporcionas directamente:</p>
          <ul className="list-disc pl-4 mt-1 space-y-1">
            <li>Cuenta: nombre, correo electronico, contrasena encriptada</li>
            <li>Perfil: foto, genero, fecha de nacimiento, biografia</li>
            <li>Armario digital: fotos de prendas, looks, organizacion del closet</li>
            <li>Fotos de cuerpo: para el probador virtual (almacenadas localmente en tu dispositivo)</li>
            <li>Uso de la app: interacciones, busquedas, preferencias</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>2. Como usamos tu informacion</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li>Para proporcionar y mejorar el servicio</li>
            <li>Para personalizar tu experiencia de estilo</li>
            <li>Para enviar notificaciones relevantes (puedes desactivarlas)</li>
            <li>Para garantizar la seguridad de la plataforma</li>
            <li>Para cumplir con obligaciones legales</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>3. Almacenamiento y seguridad</h2>
          <p>Tus datos se almacenan en servidores seguros con encriptacion. Las fotos de cuerpo se procesan localmente y no se suben a nuestros servidores. Las contrasenas se almacenan con hash unidireccional.</p>
        </section>

        <section>
          <h2 className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>4. Comparticion de datos</h2>
          <p>No vendemos tu informacion personal. Podemos compartir datos anonimos y agregados para mejorar el servicio. Los looks publicos son visibles segun tu configuracion de privacidad.</p>
        </section>

        <section>
          <h2 className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>5. Tus derechos</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li>Acceder a tus datos personales</li>
            <li>Corregir datos inexactos</li>
            <li>Solicitar la eliminacion de tu cuenta y datos</li>
            <li>Exportar tus datos en formato portable</li>
            <li>Oponerte al procesamiento de tus datos</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>6. Retencion de datos</h2>
          <p>Conservamos tu informacion mientras tu cuenta este activa. Si eliminas tu cuenta, tus datos seran eliminados permanentemente dentro de 30 dias.</p>
        </section>

        <section>
          <h2 className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>7. Cookies y tecnologias similares</h2>
          <p>Utilizamos cookies esenciales para el funcionamiento de la app. No utilizamos cookies de rastreo de terceros.</p>
        </section>

        <section>
          <h2 className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>8. Cambios en esta politica</h2>
          <p>Podemos actualizar esta politica periodicamente. Te notificaremos de cambios significativos por correo electronico o dentro de la app.</p>
        </section>

        <section>
          <h2 className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>9. Contacto</h2>
          <p>Para ejercer tus derechos o hacer preguntas sobre esta politica, contactanos a: <strong style={{ color: 'var(--color-primary)' }}>privacidad@estilovivo.com</strong></p>
        </section>
      </div>
    </div>
  )
}
