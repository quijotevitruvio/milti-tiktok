# MultiTikTok

Abre tus cuentas de TikTok desde un selector en Google Chrome. Cada cuenta usa un perfil de Chrome, así que puedes dejar abiertas varias sesiones a la vez. MultiTikTok es gratuito y funciona en **Windows x64 con Google Chrome de escritorio**.

**[Descargar MultiTikTok para Windows x64](https://github.com/quijotevitruvio/milti-tiktok/releases/latest/download/MultiTikTok-Windows-x64.zip)** · [Ver versiones](https://github.com/quijotevitruvio/milti-tiktok/releases)

## Instalar paso a paso

1. **Descarga y extrae el ZIP.** En la carpeta extraída encontrarás `extension`, `host` e `Install-Host.ps1`. Conserva esa carpeta para que Chrome pueda seguir cargando la extensión.
2. **Carga la extensión.** Escribe `chrome://extensions` en la barra de direcciones de Chrome. Activa **Modo desarrollador**, pulsa **Cargar descomprimida** y selecciona la carpeta `extension` que acabas de extraer.
3. **Copia el ID.** Busca la tarjeta de **MultiTikTok** en esa página y copia su ID de 32 letras.
4. **Instala el componente de Windows.** Abre PowerShell en la carpeta extraída y ejecuta el comando. Sustituye `TU_ID_DE_CHROME` por el ID que copiaste. El componente conecta el selector con los perfiles de Chrome y se instala para tu usuario de Windows.

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-Host.ps1 -ExtensionId TU_ID_DE_CHROME
   ```

5. **Abre MultiTikTok.** Pulsa el icono de extensiones de Chrome y selecciona **MultiTikTok**. Puedes fijarla a la barra. Si el selector ya estaba abierto, pulsa **Actualizar**.

## Agregar cuentas y cambiar entre ellas

1. Desde el menú de perfiles de Chrome, crea un perfil por cada cuenta de TikTok. Puedes nombrarlos **Personal**, **Tienda** o como prefieras. Puedes usar perfiles locales de Chrome sin vincular una cuenta de Google.
2. Vuelve a la ventana de Chrome donde instalaste MultiTikTok. Abre el popup y pulsa **Actualizar** si acabas de crear un perfil.
3. Selecciona un perfil, escribe un alias y pulsa **Vincular perfil**. Repite para las demás cuentas.
4. Pulsa **Abrir** junto al alias. Chrome abrirá TikTok en ese perfil. Si TikTok pide iniciar sesión, hazlo directamente en su página y comprueba el `@usuario` antes de publicar o responder mensajes.
5. Para cambiar de cuenta, vuelve al popup de MultiTikTok y pulsa **Abrir** junto a otro alias. **Volver a la anterior** abre el perfil usado antes del actual. El botón **⋯** permite cambiar el alias, fijarlo como favorito o desvincular el perfil.

Si un perfil aparece como **no disponible**, comprueba que aún exista en Chrome y pulsa **Actualizar**. Al desvincular un perfil, tu sesión de TikTok sigue en Chrome. Si la sesión vence, vuelve a iniciar sesión en TikTok desde ese perfil.

## Estrella en GitHub

La extensión está disponible desde que la instalas. Tras la primera apertura, el selector puede mostrar **Dar una estrella** y **Ahora no**. La estrella es voluntaria y el botón abre la página del proyecto en GitHub.

## Desinstalar

Quita MultiTikTok desde `chrome://extensions`. Para retirar el registro del componente de Windows, abre PowerShell en la carpeta extraída y ejecuta:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-Host.ps1 -Uninstall
```

Puedes eliminar la carpeta `MultiTikTok` de `%LOCALAPPDATA%` después de retirar el registro. Tus perfiles y sesiones siguen en Chrome.

## Compilar desde el código fuente

En Windows x64, con el SDK de .NET 8 o posterior, ejecuta:

```powershell
.\scripts\Build.ps1
```

El paquete instalable y el ZIP de la extensión se generan en `dist`. Para instalar desde esta carpeta de código fuente, carga `extension` en Chrome y usa `scripts\Install-Host.ps1` en el paso de instalación del componente.

[Privacidad y permisos](PRIVACIDAD.md) · [Licencia MIT](LICENSE)
