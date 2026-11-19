# Privacidad de MultiTikTok

MultiTikTok guarda una copia local de las cookies de sesión de TikTok cuando eliges **Guardar sesión**. Las usa para cambiar entre cuentas desde el selector. Inicias sesión y completas las verificaciones en TikTok. La extensión funciona sin servidor propio, telemetría, sincronización ni exportación de sesiones.

Las copias guardadas, los alias y los favoritos se cifran localmente con AES-GCM. La clave se deriva de tu frase de acceso mediante PBKDF2 y queda en la memoria de la extensión hasta que pulses **Bloquear** o se cierre Chrome. Una sesión activa de TikTok sigue bajo el control del navegador. Para cerrarla, usa TikTok.

- `storage` guarda el contenido cifrado y conserva temporalmente la clave en el área de sesión de Chrome.
- `cookies` y el permiso opcional para `https://*.tiktok.com/*` permiten leer y aplicar cookies de TikTok. El permiso para TikTok se solicita al activar el selector.

Para borrar una copia guardada, abre **⋯** en esa cuenta. Para borrar toda la lista y su configuración, elimina la extensión desde Chrome. La invitación a dar una estrella abre GitHub solo cuando pulsas el enlace.
