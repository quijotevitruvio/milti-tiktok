# Privacidad de MultiTikTok

MultiTikTok guarda una copia local de las cookies de sesión de TikTok cuando eliges **Guardar sesión**. Las usa para cambiar entre cuentas desde el selector. Inicias sesión y completas las verificaciones en TikTok. La extensión funciona sin servidor propio, telemetría, sincronización ni exportación de sesiones.

Las copias guardadas, los alias, los favoritos y las URL de las fotos se cifran localmente con AES-GCM. Por defecto, Chrome guarda la clave en el perfil local de la extensión. Si activas una frase de acceso, la clave se deriva de la frase mediante PBKDF2 y se conserva en memoria hasta que pulses **Bloquear** o cierres Chrome. Una sesión activa de TikTok sigue bajo el control del navegador. Para cerrarla, usa TikTok.

- `storage` guarda el contenido cifrado y conserva temporalmente la clave en el área de sesión de Chrome.
- `cookies` y el permiso opcional para `https://*.tiktok.com/*` permiten leer y aplicar cookies de TikTok. El permiso para TikTok se solicita al activar el selector.
- `scripting` lee la foto del perfil en la pestaña de TikTok cuando guardas una sesión. Para mostrarla, el selector solicita la imagen al CDN de TikTok sin enviar una URL de referencia.

Para borrar una copia guardada, abre **⋯** en esa cuenta. Para borrar toda la lista y su configuración, elimina la extensión desde Chrome. Los enlaces de **Apoyar** abren GitHub o PayPal solo cuando los eliges.
