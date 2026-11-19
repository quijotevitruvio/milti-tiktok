# Privacidad de MultiTikTok

MultiTikTok guarda en el almacenamiento local de la extensión los identificadores de los perfiles vinculados, sus alias, los favoritos, el historial de los dos últimos perfiles abiertos y el estado de la invitación a GitHub.

El componente de Windows lee los identificadores y nombres de perfiles desde la configuración local de Chrome para ofrecerlos en el selector. Abre únicamente la página principal de TikTok en un perfil disponible. El inicio de sesión, la autenticación y las cookies quedan a cargo de Chrome y TikTok. MultiTikTok funciona sin acceso a los sitios que visitas, sin telemetría y sin servidor propio.

La extensión usa dos permisos:

- `storage` permite guardar el selector y sus preferencias en el perfil de Chrome donde se instaló MultiTikTok.
- `nativeMessaging` conecta el popup con el componente local de Windows. El registro del componente autoriza el ID de la extensión que indicas al instalarlo.

La invitación a apoyar el proyecto abre GitHub si eliges **Dar una estrella**. No verifica tu cuenta ni la estrella. Puedes eliminar tus preferencias quitando la extensión. Desvincular una cuenta elimina el alias y la vinculación guardados. Las sesiones siguen bajo el control de Chrome y TikTok.
