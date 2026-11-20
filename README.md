# MultiTikTok

Extensión gratuita de Chrome de escritorio para alternar tus cuentas de TikTok web dentro del mismo perfil de Chrome. Se instala con los archivos de la extensión y funciona sin un componente de Windows. Esta versión está en beta.

**[Descargar MultiTikTok para Chrome](https://github.com/quijotevitruvio/milti-tiktok/releases/latest/download/MultiTikTok-Chrome.zip)** · [Ver versiones](https://github.com/quijotevitruvio/milti-tiktok/releases)

## Instalar paso a paso

1. **Descarga y extrae** `MultiTikTok-Chrome.zip`. Abre la carpeta que contiene `manifest.json`.
2. En Chrome, escribe `chrome://extensions` en la barra de direcciones y activa **Modo desarrollador**.
3. Pulsa **Cargar descomprimida** y selecciona la carpeta extraída. Conserva la carpeta mientras uses la extensión.
4. Abre **MultiTikTok** desde el menú de extensiones. Pulsa **Permitir acceso a TikTok** y confirma el permiso en Chrome.

Para actualizar una instalación existente, extrae el ZIP en la misma carpeta que ya cargaste y pulsa **Recargar** en la tarjeta de MultiTikTok en `chrome://extensions`. Así Chrome conserva las sesiones guardadas por la extensión.

La actualización automática estará disponible para las instalaciones desde Chrome Web Store cuando Google apruebe la primera publicación. Quien ya use el ZIP tendrá que instalar la edición de la tienda una vez. Chrome puede asignarle un ID distinto a la instalación descomprimida, por lo que esa edición podría requerir volver a guardar las cuentas.

## Agregar cuentas y cambiar entre ellas

1. Abre MultiTikTok, concede acceso a TikTok y elige **Agregar cuenta**. Si ya tienes una sesión abierta, puedes guardarla primero.
2. Inicia sesión en la página de TikTok. Cuando el selector detecte que la sesión está lista, escribe un alias como **Personal** y guárdala. El panel lateral permite tener las instrucciones a la vista.
3. Repite **Agregar cuenta** para la siguiente. Guarda antes cualquier trabajo y deja una sola pestaña de TikTok abierta. Si hay varias, el selector te ayuda a encontrarlas.
4. Elige una cuenta guardada. La pantalla oscura indica que MultiTikTok está cambiando la sesión. Si estabas en una vista compatible, la extensión vuelve a abrirla sin conservar los parámetros ni el fragmento de la URL.
5. Comprueba el `@usuario` en TikTok antes de publicar o contestar mensajes. El selector muestra el usuario y la foto cuando puede detectarlos desde la página.

**Volver a la anterior** aplica la sesión que usabas antes. Puedes buscar por alias o por `@usuario`. Desde **⋯** puedes cambiar el alias y el color, marcar una favorita, ajustar su lugar en la lista o borrar su copia. Al guardar de nuevo una cuenta, el selector actualiza su foto cuando está disponible.

Si la sesión vence, usa **Reconectar** en la cuenta guardada. MultiTikTok conserva el alias y las preferencias cuando reconoce la misma cuenta. Si el selector indica una interrupción, cierra otras pestañas de TikTok y elige **Restaurar sesión**. Para cerrar por completo tu sesión activa, usa TikTok.

Desde **Configuración** puedes activar el **modo rápido**. Las comprobaciones de pestañas y sesiones sin guardar siguen aplicándose. Puedes configurar los atajos para abrir el selector o volver a la cuenta anterior desde `chrome://extensions/shortcuts`.

## Frase de acceso opcional

El selector se abre sin frase por defecto. Para añadirla, ve a **Configuración**, marca **Pedir frase de acceso** y guarda una frase de al menos 12 caracteres. Te la pedirá después de reiniciar Chrome o de pulsar **Bloquear**. Puedes desactivar esa opción desde el mismo menú.

Si actualizas desde la versión 0.2 y ya tenías una frase, úsala una vez para abrir tus sesiones. Luego podrás desactivar la protección desde **Configuración** y conservar las cuentas. Si olvidas la frase, quitar y volver a instalar la extensión permite empezar de nuevo.

Si activas la frase, puedes elegir un tiempo de inactividad para bloquear el selector. **Borrar todas las copias** elimina los datos guardados en MultiTikTok y conserva la sesión abierta en TikTok.

## Qué puedes esperar de esta beta

- Usa Chrome de escritorio 130 o posterior en un perfil normal. Las pestañas de TikTok del mismo perfil comparten una sola sesión activa.
- El cambio usa cookies de TikTok. Si el sitio modifica su inicio de sesión o deja de aceptar una sesión guardada, inicia sesión de nuevo directamente en TikTok.
- Probamos la rotación y la recuperación con sesiones simuladas. Aún falta validar la compatibilidad con cuentas reales, regiones y métodos de inicio de sesión de TikTok.

## Apoyar el proyecto

En el selector, **Dar estrella** abre el [repositorio de MultiTikTok](https://github.com/quijotevitruvio/milti-tiktok), **Cafecito** abre [PayPal](https://paypal.me/bibliotecologo) y **Sígueme** muestra los perfiles de [GitHub](https://github.com/quijotevitruvio) y [LinkedIn](https://www.linkedin.com/in/andr%C3%A9s-valencia-tob%C3%B3n/). Después del primer cambio puede aparecer una invitación que puedes omitir con **Ahora no**. El apoyo es voluntario y la extensión está disponible desde la instalación.

Desde **Reportar un problema** puedes abrir un borrador en GitHub con la versión de MultiTikTok y, si existe, un código de error. Los datos de las cuentas quedan en la extensión.

## Compilar desde el código fuente

Carga la carpeta `extension` como extensión descomprimida. Para crear el ZIP, ejecuta `python scripts/build.py` desde la raíz del proyecto. El archivo resultante queda en `dist`.

## Publicar futuras versiones

La acción [Chrome Web Store](https://github.com/quijotevitruvio/milti-tiktok/actions/workflows/chrome-web-store.yml) verifica que el ZIP de cada versión pública de GitHub coincida con su etiqueta `vX.Y.Z` y su manifiesto. Una vez conectada a la tienda, envía el paquete para revisión. Chrome distribuye la versión después de que Google la aprueba. [API de Chrome Web Store](https://developer.chrome.com/docs/webstore/using-api)

Para conectar la tienda por primera vez, crea la ficha en el [panel de desarrollador](https://chrome.google.com/webstore/devconsole) con el ZIP de GitHub. Después habilita Chrome Web Store API en Google Cloud, vincula una cuenta de servicio desde el panel y usa [Workload Identity Federation](https://github.com/google-github-actions/auth#workload-identity-federation-through-a-service-account) para que GitHub obtenga tokens de corta duración. Limita el proveedor al repositorio `quijotevitruvio/milti-tiktok` y a su workflow `chrome-web-store.yml`. [Configurar una cuenta de servicio](https://developer.chrome.com/docs/webstore/service-accounts)

En **Settings → Secrets and variables → Actions → Variables**, configura `CWS_PUBLISHER_ID`, `CWS_ITEM_ID`, `CWS_WORKLOAD_IDENTITY_PROVIDER` y `CWS_SERVICE_ACCOUNT`. Activa el envío con `CWS_ENABLED=true` cuando esté lista la ficha. El flujo también se puede ejecutar desde **Actions**, con un tag ya publicado y **Solo verificar el ZIP** para comprobar el paquete sin enviarlo.

[Privacidad y permisos](PRIVACIDAD.md) · [Licencia MIT](LICENSE)
