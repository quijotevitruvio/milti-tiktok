# MultiTikTok

Extensión gratuita de Chrome de escritorio para alternar tus cuentas de TikTok web dentro del mismo perfil de Chrome. Se instala con los archivos de la extensión y funciona sin un componente de Windows. Esta versión está en beta.

**[Descargar MultiTikTok para Chrome](https://github.com/quijotevitruvio/milti-tiktok/releases/latest/download/MultiTikTok-Chrome.zip)** · [Ver versiones](https://github.com/quijotevitruvio/milti-tiktok/releases)

## Instalar paso a paso

1. **Descarga y extrae** `MultiTikTok-Chrome.zip`. Abre la carpeta que contiene `manifest.json`.
2. En Chrome, escribe `chrome://extensions` en la barra de direcciones y activa **Modo desarrollador**.
3. Pulsa **Cargar descomprimida** y selecciona la carpeta extraída. Conserva la carpeta mientras uses la extensión.
4. Abre **MultiTikTok** desde el menú de extensiones. Pulsa **Permitir acceso a TikTok** y confirma el permiso en Chrome.

Para actualizar una instalación existente, extrae el ZIP en la misma carpeta que ya cargaste y pulsa **Recargar** en la tarjeta de MultiTikTok en `chrome://extensions`. Así Chrome conserva las sesiones guardadas por la extensión.

## Agregar cuentas y cambiar entre ellas

1. Abre TikTok en una sola pestaña, inicia sesión y comprueba el `@usuario`.
2. Abre MultiTikTok, escribe un alias como **Personal** y pulsa **Guardar sesión**.
3. Pulsa **Iniciar sesión en otra cuenta**. Guarda antes cualquier trabajo en TikTok y cierra sus otras pestañas, también las de otras ventanas. Confirma con **Continuar**.
4. Inicia sesión en TikTok con tu segunda cuenta y guárdala con otro alias. Repite para las demás cuentas.
5. Selecciona una cuenta guardada y confirma el cambio. Chrome abrirá TikTok con las cookies guardadas de esa cuenta. Comprueba allí el `@usuario` antes de publicar o contestar mensajes.

**Volver a la anterior** aplica la sesión que usabas antes. Desde **⋯** puedes editar el alias, marcar una favorita o borrar su copia de la extensión. Al guardar, el selector usa la foto de la cuenta si TikTok la muestra en el menú de perfil. Si falta la foto, verás la inicial del alias. Para cerrar tu sesión activa, usa TikTok.

Si TikTok cierra una sesión o pide verificación, vuelve a iniciar sesión en el sitio y guarda la sesión de nuevo. Si el selector indica una interrupción, cierra otras pestañas de TikTok y elige **Restaurar sesión**.

## Frase de acceso opcional

El selector se abre sin frase por defecto. Para añadirla, ve a **Configuración**, marca **Pedir frase de acceso** y guarda una frase de al menos 12 caracteres. Te la pedirá después de reiniciar Chrome o de pulsar **Bloquear**. Puedes desactivar esa opción desde el mismo menú.

Si actualizas desde la versión 0.2 y ya tenías una frase, úsala una vez para abrir tus sesiones. Luego podrás desactivar la protección desde **Configuración** y conservar las cuentas. Si olvidas la frase, quitar y volver a instalar la extensión permite empezar de nuevo.

## Qué puedes esperar de esta beta

- Usa Chrome de escritorio 130 o posterior en un perfil normal. Las pestañas de TikTok del mismo perfil comparten una sola sesión activa.
- El cambio usa cookies de TikTok. Si el sitio modifica su inicio de sesión o deja de aceptar una sesión guardada, inicia sesión de nuevo directamente en TikTok.
- Probamos la rotación y la recuperación con sesiones simuladas. Aún falta validar la compatibilidad con cuentas reales, regiones y métodos de inicio de sesión de TikTok.

## Apoyar el proyecto

Desde **Apoyar** puedes seguir a [@quijotevitruvio](https://github.com/quijotevitruvio), dar una estrella al [repositorio de MultiTikTok](https://github.com/quijotevitruvio/milti-tiktok) o [invitarme a un cafecito por PayPal](https://paypal.me/bibliotecologo). Después del primer cambio también puede aparecer una invitación que puedes omitir con **Ahora no**. El apoyo es voluntario y la extensión está disponible desde la instalación.

## Compilar desde el código fuente

Carga la carpeta `extension` como extensión descomprimida. Para crear el ZIP, ejecuta `python scripts/build.py` desde la raíz del proyecto. El archivo resultante queda en `dist`.

[Privacidad y permisos](PRIVACIDAD.md) · [Licencia MIT](LICENSE)
