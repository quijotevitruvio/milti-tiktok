const labels = new Map([
  ["Cuenta anterior", ["Previous account", "Conta anterior"]],
  ["Cuenta de destino", ["Target account", "Conta de destino"]],
  ["¿Limpiar el historial?", ["Clear switch history?", "Limpar o histórico?"]],
  ["Se eliminará el historial de cambios de cuenta de este perfil de Chrome.", ["This will clear the switch history for this Chrome profile.", "Isso apagará o histórico de trocas de conta deste perfil do Chrome."]],
  ["Copia de organización exportada.", ["Organization backup exported.", "Backup da organização exportado."]],
  ["¿Importar esta organización?", ["Import this organization backup?", "Importar este backup da organização?"]],
  ["Se aplicarán los datos de organización del archivo. Reconecta en TikTok las cuentas importadas que necesiten una sesión.", ["The organization data from the file will be applied. Reconnect imported accounts on TikTok when a session is needed.", "Os dados de organização do arquivo serão aplicados. Reconecte no TikTok as contas importadas que precisarem de uma sessão."]],
  ["¿Borrar las copias seleccionadas?", ["Delete the selected saved copies?", "Apagar as cópias selecionadas?"]],
  ["Se borrarán las copias seleccionadas de este perfil de Chrome. Podrás volver a guardarlas iniciando sesión en TikTok.", ["This will delete the selected copies from this Chrome profile. You can save them again by signing in on TikTok.", "Isso apagará as cópias selecionadas deste perfil do Chrome. Você poderá salvá-las de novo fazendo login no TikTok."]],
  ["Comprueba el @usuario tras cambiar, agrupa tus cuentas y accede rápido a Perfil, Subir video y TikTok Studio.", ["Verify your username after switching, group your accounts, and quickly open your profile, uploads, or TikTok Studio.", "Confira o @usuário após trocar, agrupe suas contas e acesse rapidamente o perfil, o envio de vídeos ou o TikTok Studio."]],
  ["¿Te sirvió MultiTikTok? Una estrella ayuda a que más personas lo encuentren.", ["Was MultiTikTok helpful? A star helps more people find it.", "O MultiTikTok foi útil? Uma estrela ajuda mais pessoas a encontrá-lo."]],
  ["Confirma que quieres continuar con esta cuenta.", ["Confirm that you want to continue with this account.", "Confirme que quer continuar com esta conta."]],
  ["La cuenta activa no se puede archivar. Cambia de cuenta e inténtalo de nuevo.", ["Switch accounts before archiving the active account.", "Troque de conta antes de arquivar a conta ativa."]],
  ["Elige un JSON de organización exportado por MultiTikTok.", ["Choose an organization JSON file exported by MultiTikTok.", "Escolha um arquivo JSON de organização exportado pelo MultiTikTok."]],
  ["La lista de copias antiguas cambió. Revisa la selección de nuevo.", ["The list of old copies changed. Review your selection again.", "A lista de cópias antigas mudou. Confira a seleção novamente."]],
  ["Este acceso rápido ya no está disponible.", ["This quick link is no longer available.", "Este atalho não está mais disponível."]],
  ["TikTok tiene abierta una página de edición o subida. Guarda tu trabajo antes de continuar.", ["A TikTok editing or upload page is open. Save your work before continuing.", "Há uma página de edição ou envio aberta no TikTok. Salve seu trabalho antes de continuar."]],
  ["En TikTok", ["On TikTok", "No TikTok"]],
  ["Por comprobar", ["Awaiting verification", "A verificar"]],
  ["Comprobando qué cuenta quedó abierta en TikTok…", ["Checking which account is open on TikTok…", "Verificando qual conta está aberta no TikTok…"]],
  ["La cuenta quedó confirmada en TikTok.", ["The account was verified on TikTok.", "A conta foi confirmada no TikTok."]],
  ["TikTok muestra otra cuenta.", ["TikTok shows a different account.", "O TikTok mostra outra conta."]],
  ["Todavía no se pudo comprobar el @usuario.", ["The username could not be verified yet.", "Ainda não foi possível verificar o @usuário."]],
  ["Ver cuentas por reconectar", ["See accounts to reconnect", "Ver contas para reconectar"]],
  ["Ver pestañas de TikTok", ["See TikTok tabs", "Ver abas do TikTok"]],
  ["Actualizar el selector", ["Refresh the switcher", "Atualizar o seletor"]],
  ["Restablece el acceso a TikTok", ["Restore access to TikTok", "Restaure o acesso ao TikTok"]],
  ["Restablecer acceso a TikTok", ["Restore TikTok access", "Restaurar acesso ao TikTok"]],
  ["Cuenta sin identificar", ["Unidentified account", "Conta não identificada"]],
  ["Agregar otra cuenta", ["Add another account", "Adicionar outra conta"]],
  ["Guarda lo que estés haciendo y comprueba tu @usuario en TikTok después del cambio.", ["Save your work and check your username on TikTok after switching.", "Salve seu trabalho e confira seu @usuário no TikTok após trocar de conta."]],
  ["Se abrirá la sección seleccionada en TikTok.", ["The selected section will open on TikTok.", "A seção selecionada será aberta no TikTok."]],
  ["Guarda lo que estés haciendo. Se abrirá el inicio de sesión oficial de TikTok.", ["Save your work. The official TikTok sign-in page will open.", "Salve seu trabalho. A página oficial de login do TikTok será aberta."]],
  ["Cambio simulado.", ["Simulated switch.", "Troca simulada."]],
  ["Abrir el selector", ["Open the switcher", "Abrir o seletor"]],
  ["Volver a la cuenta anterior", ["Switch to the previous account", "Voltar à conta anterior"]],
  ["Cambiar a la favorita", ["Switch to the favorite account", "Trocar para a conta favorita"]],
  ["Sin favorita asignada", ["No favorite assigned", "Nenhuma favorita selecionada"]],
  ["Chrome no pudo abrir el panel lateral. Vuelve a intentarlo.", ["Chrome could not open the side panel. Try again.", "O Chrome não conseguiu abrir o painel lateral. Tente novamente."]],
  ["Configuración guardada.", ["Settings saved.", "Configurações salvas."]],
  ["Se borraron las copias guardadas.", ["Saved copies deleted.", "Cópias salvas apagadas."]],
  ["Sesión anterior restaurada. Comprueba tu @usuario en TikTok.", ["Previous session restored. Check your username on TikTok.", "Sessão anterior restaurada. Confira seu @usuário no TikTok."]],
  ["Esta cuenta ya estaba guardada. Actualizamos su sesión y conservamos su organización.", ["This account was already saved. We updated its session and kept its organization.", "Esta conta já estava salva. Atualizamos a sessão e mantivemos a organização."]],
  ["Sesión guardada.", ["Session saved.", "Sessão salva."]],
  ["Inicio de sesión cancelado.", ["Sign-in canceled.", "Login cancelado."]],
  ["Cambios guardados.", ["Changes saved.", "Alterações salvas."]],
  ["Perfil actualizado.", ["Profile updated.", "Perfil atualizado."]],
  ["Cuenta archivada.", ["Account archived.", "Conta arquivada."]],
  ["Cuenta restaurada.", ["Account unarchived.", "Conta desarquivada."]],
  ["Se borró la copia guardada.", ["Saved copy deleted.", "Cópia salva apagada."]],
  ["Panel lateral", ["Side panel", "Painel lateral"]],
  ["Configuración", ["Settings", "Configurações"]],
  ["Permite el acceso a TikTok", ["Allow access to TikTok", "Permita o acesso ao TikTok"]],
  ["Permitir acceso a TikTok", ["Allow TikTok access", "Permitir acesso ao TikTok"]],
  ["MultiTikTok necesita acceso a TikTok para guardar y cambiar tus sesiones en este perfil de Chrome.", ["MultiTikTok needs TikTok access to save and switch sessions in this Chrome profile.", "O MultiTikTok precisa acessar o TikTok para salvar e alternar suas sessões neste perfil do Chrome."]],
  ["Frase de acceso", ["Passphrase", "Frase de acesso"]],
  ["Desbloquear sesiones", ["Unlock sessions", "Desbloquear sessões"]],
  ["Cambio interrumpido", ["Switch interrupted", "Troca interrompida"]],
  ["Restaura la sesión anterior y comprueba en TikTok qué cuenta quedó abierta.", ["Restore the previous session and check which account is open on TikTok.", "Restaure a sessão anterior e confira qual conta está aberta no TikTok."]],
  ["Reportar problema", ["Report a problem", "Relatar um problema"]],
  ["Restaurar sesión", ["Restore session", "Restaurar sessão"]],
  ["Sesión en TikTok", ["TikTok session", "Sessão no TikTok"]],
  ["Sesión sin guardar", ["Unsaved session", "Sessão não salva"]],
  ["Identidad por confirmar", ["Account not yet confirmed", "Conta a confirmar"]],
  ["Comprueba qué cuenta está abierta en TikTok.", ["Check which account is open on TikTok.", "Confira qual conta está aberta no TikTok."]],
  ["1 pestaña de TikTok abierta", ["1 TikTok tab open", "1 aba do TikTok aberta"]],
  ["Pestañas abiertas de TikTok", ["Open TikTok tabs", "Abas abertas do TikTok"]],
  ["Para cambiar o guardar, deja abierta una sola pestaña de TikTok. Guarda tu trabajo antes de cerrar las demás.", ["Keep just one TikTok tab open to switch or save. Save your work before closing the others.", "Deixe apenas uma aba do TikTok aberta para alternar ou salvar. Salve seu trabalho antes de fechar as outras."]],
  ["Guarda tu primera cuenta", ["Save your first account", "Salve sua primeira conta"]],
  ["Abre TikTok desde el selector.", ["Open TikTok from the selector.", "Abra o TikTok pelo seletor."]],
  ["Inicia sesión en TikTok y vuelve aquí.", ["Sign in on TikTok and come back here.", "Entre no TikTok e volte aqui."]],
  ["Elige un alias y guarda la sesión.", ["Choose an alias and save the session.", "Escolha um apelido e salve a sessão."]],
  ["Cancelar", ["Cancel", "Cancelar"]],
  ["Volver a TikTok", ["Back to TikTok", "Voltar ao TikTok"]],
  ["Abrir inicio de sesión", ["Open sign-in", "Abrir login"]],
  ["Ponle un nombre a esta cuenta", ["Name this account", "Dê um nome a esta conta"]],
  ["Ej. Personal o Tienda", ["E.g. Personal or Shop", "Ex.: Pessoal ou Loja"]],
  ["Guardar sesión", ["Save session", "Salvar sessão"]],
  ["Guardar reconexión", ["Save restored session", "Salvar reconexão"]],
  ["Abre la página de inicio de TikTok en esa pestaña para continuar.", ["Open the TikTok home page in that tab to continue.", "Abra a página inicial do TikTok nessa aba para continuar."]],
  ["Tus cuentas", ["Your accounts", "Suas contas"]],
  ["Volver a la anterior", ["Back to previous account", "Voltar à conta anterior"]],
  ["Buscar por alias o @usuario", ["Search by alias or @username", "Buscar por apelido ou @usuário"]],
  ["No hay cuentas que coincidan.", ["No matching accounts.", "Nenhuma conta encontrada."]],
  ["Agregar cuenta", ["Add account", "Adicionar conta"]],
  ["Inicia sesión en tu nueva cuenta", ["Sign in to your new account", "Entre na sua nova conta"]],
  ["Completa el inicio de sesión en TikTok y vuelve al selector.", ["Finish signing in on TikTok and return to the selector.", "Termine de entrar no TikTok e volte ao seletor."]],
  ["Ya puedes guardar esta sesión.", ["You can now save this session.", "Agora você pode salvar esta sessão."]],
  ["La cuenta abierta ya está guardada. Selecciona otra cuenta en TikTok.", ["This account is already saved. Choose another account on TikTok.", "Esta conta já está salva. Selecione outra conta no TikTok."]],
  ["Ahora no", ["Not now", "Agora não"]],
  ["Dar una estrella en GitHub", ["Star on GitHub", "Dar uma estrela no GitHub"]],
  ["Estrella", ["Star", "Estrela"]],
  ["Cafecito", ["Coffee", "Cafezinho"]],
  ["Invítame a un cafecito por PayPal", ["Buy me a coffee on PayPal", "Pague um cafezinho pelo PayPal"]],
  ["Sígueme", ["Follow me", "Siga-me"]],
  ["Sígueme en redes", ["Follow me on social media", "Siga-me nas redes"]],
  ["Apoyar el proyecto", ["Support the project", "Apoiar o projeto"]],
  ["Seguir a @quijotevitruvio en GitHub", ["Follow @quijotevitruvio on GitHub", "Siga @quijotevitruvio no GitHub"]],
  ["Seguirme en LinkedIn", ["Follow me on LinkedIn", "Siga-me no LinkedIn"]],
  ["Cerrar", ["Close", "Fechar"]],
  ["Pedir frase de acceso", ["Require a passphrase", "Solicitar frase de acesso"]],
  ["Al activarla, se te pedirá al reiniciar Chrome o al bloquear el selector.", ["When enabled, Chrome asks for it after a restart or when you lock the selector.", "Quando ativada, será solicitada ao reiniciar o Chrome ou bloquear o seletor."]],
  ["Nueva frase de acceso", ["New passphrase", "Nova frase de acesso"]],
  ["Al menos 12 caracteres", ["At least 12 characters", "Pelo menos 12 caracteres"]],
  ["Cambio rápido entre cuentas guardadas", ["Quick switch between saved accounts", "Troca rápida entre contas salvas"]],
  ["Omite la confirmación habitual al cambiar. Los avisos de seguridad siguen activos.", ["Skip the usual confirmation. Safety checks remain active.", "Pule a confirmação comum. Os avisos de segurança continuam ativos."]],
  ["Bloquear por inactividad", ["Lock after inactivity", "Bloquear por inatividade"]],
  ["Desactivado", ["Off", "Desativado"]],
  ["5 minutos", ["5 minutes", "5 minutos"]],
  ["15 minutos", ["15 minutes", "15 minutos"]],
  ["30 minutos", ["30 minutes", "30 minutos"]],
  ["1 hora", ["1 hour", "1 hora"]],
  ["Requiere una frase de acceso.", ["Requires a passphrase.", "Requer uma frase de acesso."]],
  ["Bloquear", ["Lock", "Bloquear"]],
  ["Guardar", ["Save", "Salvar"]],
  ["Borrar todas las copias", ["Delete all saved copies", "Apagar todas as cópias"]],
  ["Editar cuenta", ["Edit account", "Editar conta"]],
  ["Alias", ["Alias", "Apelido"]],
  ["Fijar como favorita", ["Mark as favorite", "Marcar como favorita"]],
  ["Color de cuenta", ["Account color", "Cor da conta"]],
  ["Quitar color", ["Remove color", "Remover cor"]],
  ["Subir", ["Move up", "Mover para cima"]],
  ["Bajar", ["Move down", "Mover para baixo"]],
  ["Reconectar en TikTok", ["Reconnect on TikTok", "Reconectar no TikTok"]],
  ["Actualizar perfil guardado", ["Refresh saved profile", "Atualizar perfil salvo"]],
  ["Borrar copia", ["Delete saved copy", "Apagar cópia"]],
  ["Continuar", ["Continue", "Continuar"]],
  ["Cambiar", ["Switch", "Alternar"]],
  ["Favorita", ["Favorite", "Favorita"]],
  ["Sesión abierta", ["Session open", "Sessão aberta"]],
  ["Abierta", ["Open", "Aberta"]],
  ["Un momento…", ["One moment…", "Um momento…"]],
  ["Guarda la sesión abierta", ["Save the open session", "Salve a sessão aberta"]],
  ["Hay una sesión de TikTok sin guardar. Guárdala con un alias y vuelve a elegir la cuenta.", ["A TikTok session is unsaved. Save it with an alias and choose the account again.", "Há uma sessão do TikTok não salva. Salve com um apelido e selecione a conta novamente."]],
  ["¿Borrar todas las copias?", ["Delete all saved copies?", "Apagar todas as cópias?"]],
  ["Se borrarán las cuentas guardadas en este perfil de Chrome. La sesión abierta en TikTok seguirá disponible.", ["Saved accounts in this Chrome profile will be deleted. The current TikTok session stays open.", "As contas salvas neste perfil do Chrome serão apagadas. A sessão aberta no TikTok continuará disponível."]],
  ["La cuenta seguirá disponible en TikTok. Para usarla aquí de nuevo, inicia sesión y guarda una copia.", ["The account stays available on TikTok. To use it here again, sign in and save a copy.", "A conta continuará disponível no TikTok. Para usá-la aqui novamente, entre e salve uma cópia."]],
  ["Selecciona en TikTok el @usuario de la cuenta que quieres reconectar.", ["Choose the @username of the account you want to reconnect on TikTok.", "Selecione no TikTok o @usuário da conta que deseja reconectar."]],
  ["Escribe un alias de hasta 48 caracteres.", ["Enter an alias of up to 48 characters.", "Digite um apelido de até 48 caracteres."]],
  ["Hay una operación en curso. Vuelve a intentarlo en un momento.", ["An operation is in progress. Try again in a moment.", "Há uma operação em andamento. Tente novamente em instantes."]],
  ["La sesión guardada venció. Abre su menú y elige Reconectar en TikTok.", ["The saved session expired. Open its menu and choose Reconnect on TikTok.", "A sessão salva expirou. Abra o menu e escolha Reconectar no TikTok."]],
  ["No se pudo abrir esta pestaña. Actualiza la lista y vuelve a intentarlo.", ["This tab could not be opened. Refresh the list and try again.", "Não foi possível abrir esta aba. Atualize a lista e tente novamente."]],
  ["Espera a que TikTok cargue tu perfil y comprueba tu @usuario.", ["Wait for TikTok to load your profile and check your @username.", "Aguarde o TikTok carregar seu perfil e confira seu @usuário."]],
  ["El cambio se interrumpió. Comprueba la sesión en TikTok y vuelve al selector.", ["The switch was interrupted. Check your session on TikTok and return to the selector.", "A troca foi interrompida. Confira a sessão no TikTok e volte ao seletor."]],
  ["Elige un color de cuenta válido.", ["Choose a valid account color.", "Escolha uma cor válida para a conta."]],
  ["La lista cambió. Revisa el orden y vuelve a intentarlo.", ["The list changed. Check the order and try again.", "A lista mudou. Confira a ordem e tente novamente."]],
  ["Desbloquea las sesiones con tu frase de acceso.", ["Unlock the sessions with your passphrase.", "Desbloqueie as sessões com sua frase de acesso."]],
  ["Guarda tu trabajo y deja una sola pestaña de TikTok abierta en este perfil de Chrome.", ["Save your work and keep only one TikTok tab open in this Chrome profile.", "Salve seu trabalho e deixe só uma aba do TikTok aberta neste perfil do Chrome."]],
  ["Chrome no pudo abrir TikTok. Usa el enlace de inicio de sesión.", ["Chrome could not open TikTok. Use the sign-in link.", "O Chrome não conseguiu abrir o TikTok. Use o link de login."]],
  ["Chrome no pudo preparar la pestaña. Guarda tu trabajo y vuelve a intentarlo.", ["Chrome could not prepare the tab. Save your work and try again.", "O Chrome não conseguiu preparar a aba. Salve seu trabalho e tente novamente."]],
  ["Permite el acceso a TikTok para continuar.", ["Allow TikTok access to continue.", "Permita o acesso ao TikTok para continuar."]],
  ["Escribe una frase de acceso de entre 12 y 256 caracteres.", ["Enter a passphrase of 12 to 256 characters.", "Digite uma frase de acesso de 12 a 256 caracteres."]],
  ["El último cambio se interrumpió. Restaura la sesión anterior.", ["The last switch was interrupted. Restore the previous session.", "A última troca foi interrompida. Restaure a sessão anterior."]],
  ["Se restauró la sesión anterior. Comprueba tu @usuario en TikTok.", ["The previous session was restored. Check your @username on TikTok.", "A sessão anterior foi restaurada. Confira seu @usuário no TikTok."]],
  ["Deja una sola pestaña de TikTok abierta para guardar la sesión.", ["Keep just one TikTok tab open to save the session.", "Deixe apenas uma aba do TikTok aberta para salvar a sessão."]],
  ["Termina o cancela el inicio de sesión en curso.", ["Finish or cancel the current sign-in.", "Conclua ou cancele o login em andamento."]],
  ["Inicia sesión en TikTok y comprueba que aparezca tu @usuario.", ["Sign in on TikTok and check that your @username appears.", "Entre no TikTok e confira se seu @usuário aparece."]],
  ["Chrome no pudo guardar los cambios. Vuelve a intentarlo.", ["Chrome could not save the changes. Try again.", "O Chrome não conseguiu salvar as alterações. Tente novamente."]],
  ["La cuenta ya no está guardada.", ["The account is no longer saved.", "A conta não está mais salva."]],
  ["Guarda la sesión abierta antes de cambiar.", ["Save the open session before switching.", "Salve a sessão aberta antes de trocar."]],
  ["Comprueba tu frase de acceso e inténtalo de nuevo.", ["Check your passphrase and try again.", "Confira sua frase de acesso e tente novamente."]],
  ["La acción quedó sin completar. Cierra y vuelve a abrir el selector.", ["The action did not finish. Close and reopen the selector.", "A ação não foi concluída. Feche e reabra o seletor."]],
  ["Probar la demo", ["Try the demo", "Testar a demonstração"]],
  ["Estás usando cuentas de ejemplo. Las acciones son simuladas.", ["You’re using sample accounts. Actions are simulated.", "Você está usando contas de exemplo. As ações são simuladas."]],
  ["Salir de la demo", ["Exit demo", "Sair da demonstração"]],
  ["Qué revisar", ["What to check", "O que verificar"]],
  ["Ver en TikTok", ["Check on TikTok", "Conferir no TikTok"]],
  ["Deshacer cambio", ["Undo switch", "Desfazer troca"]],
  ["Novedades de MultiTikTok", ["What's new in MultiTikTok", "Novidades do MultiTikTok"]],
  ["Comprueba el @usuario tras cambiar, agrupa tus cuentas y accede rápido a Perfil, Subir y TikTok Studio.", ["Check the @username after switching, group accounts, and jump to Profile, Upload, or TikTok Studio.", "Confira o @usuário depois de trocar, agrupe suas contas e acesse Perfil, Enviar ou TikTok Studio."]],
  ["Entendido", ["Got it", "Entendi"]],
  ["Filtrar cuentas", ["Filter accounts", "Filtrar contas"]],
  ["Cuentas sin archivar", ["Unarchived accounts", "Contas não arquivadas"]],
  ["Favoritas", ["Favorites", "Favoritas"]],
  ["Por reconectar", ["Needs reconnecting", "A reconectar"]],
  ["Archivadas", ["Archived", "Arquivadas"]],
  ["Filtrar por grupo", ["Filter by group", "Filtrar por grupo"]],
  ["Todos los grupos", ["All groups", "Todos os grupos"]],
  ["Sin grupo", ["Ungrouped", "Sem grupo"]],
  ["Densidad", ["Layout density", "Densidade"]],
  ["Cómoda", ["Comfortable", "Confortável"]],
  ["Compacta", ["Compact", "Compacta"]],
  ["Orden", ["Sort order", "Ordem"]],
  ["Manual", ["Manual", "Manual"]],
  ["Uso reciente", ["Recently used", "Uso recente"]],
  ["Idioma", ["Language", "Idioma"]],
  ["Alto contraste", ["High contrast", "Alto contraste"]],
  ["Cuenta favorita para el atajo", ["Favorite account shortcut", "Conta favorita para o atalho"]],
  ["Sin asignar", ["Unassigned", "Sem atribuição"]],
  ["Datos locales", ["Local data", "Dados locais"]],
  ["Historial de cambios", ["Switch history", "Histórico de trocas"]],
  ["Aún no hay cambios registrados.", ["No switches recorded yet.", "Ainda não há trocas registradas."]],
  ["Limpiar historial", ["Clear history", "Limpar histórico"]],
  ["Copia de organización", ["Organization backup", "Cópia da organização"]],
  ["Incluye alias, grupos, colores, favoritos y preferencias por cuenta. Tus sesiones y notas privadas quedan en Chrome.", ["Includes aliases, groups, colors, favorites, and per-account preferences. Sessions and private notes stay in Chrome.", "Inclui apelidos, grupos, cores, favoritos e preferências por conta. Suas sessões e notas privadas ficam no Chrome."]],
  ["Exportar JSON", ["Export JSON", "Exportar JSON"]],
  ["Importar JSON", ["Import JSON", "Importar JSON"]],
  ["Revisar copias antiguas", ["Review old saved copies", "Revisar cópias antigas"]],
  ["Sesiones sin usar ni guardar en los últimos 90 días. Selecciona las que quieras borrar.", ["Sessions not used or saved in the last 90 days. Select the ones to delete.", "Sessões não usadas nem salvas nos últimos 90 dias. Selecione as que deseja apagar."]],
  ["No hay copias antiguas para revisar.", ["There are no old copies to review.", "Não há cópias antigas para revisar."]],
  ["Borrar seleccionadas", ["Delete selected", "Apagar selecionadas"]],
  ["Confirmar siempre antes de cambiar a esta cuenta", ["Always confirm before switching to this account", "Sempre confirmar antes de alternar para esta conta"]],
  ["Grupo", ["Group", "Grupo"]],
  ["Nota privada", ["Private note", "Nota privada"]],
  ["Esta nota se queda en tu perfil de Chrome.", ["This note stays in your Chrome profile.", "Esta nota fica no seu perfil do Chrome."]],
  ["Archivar cuenta", ["Archive account", "Arquivar conta"]],
  ["Restaurar cuenta", ["Unarchive account", "Desarquivar conta"]],
  ["Ahora", ["Now", "Agora"]],
  ["Después", ["Next", "Depois"]],
  ["Accesos rápidos", ["Quick links", "Atalhos"]],
  ["Perfil", ["Profile", "Perfil"]],
  ["Subir video", ["Upload video", "Enviar vídeo"]],
  ["Progreso de inicio de sesión", ["Sign-in progress", "Progresso do login"]],
  ["Preparando la sesión", ["Preparing the session", "Preparando a sessão"]],
  ["Espera un momento mientras se prepara TikTok.", ["Wait a moment while TikTok is being prepared.", "Aguarde um momento enquanto preparamos o TikTok."]],
  ["Abriendo TikTok para iniciar sesión", ["Opening TikTok sign-in", "Abrindo o login do TikTok"]],
  ["Restaurando la sesión anterior", ["Restoring the previous session", "Restaurando a sessão anterior"]],
  ["No se pudo completar el cambio", ["Could not complete the switch", "Não foi possível concluir a troca"]],
  ["Reintentar", ["Retry", "Tentar novamente"]],
  ["Abrir MultiTikTok", ["Open MultiTikTok", "Abrir MultiTikTok"]],
  ["Hay una operación en curso. Espera un momento y vuelve a intentarlo.", ["An operation is in progress. Wait a moment and try again.", "Há uma operação em andamento. Aguarde um momento e tente novamente."]],
  ["Abre MultiTikTok para consultar el estado de la sesión o reintenta abrir TikTok.", ["Open MultiTikTok to check the session or try opening TikTok again.", "Abra o MultiTikTok para conferir a sessão ou tente abrir o TikTok novamente."]],
  ["Abre MultiTikTok y desbloquea la bóveda para continuar.", ["Open MultiTikTok and unlock your saved sessions to continue.", "Abra o MultiTikTok e desbloqueie as sessões salvas para continuar."]],
  ["Deja una sola pestaña de TikTok abierta para continuar.", ["Keep just one TikTok tab open to continue.", "Deixe apenas uma aba do TikTok aberta para continuar."]],
  ["Chrome no pudo abrir TikTok. Puedes reintentar desde aquí.", ["Chrome could not open TikTok. You can retry here.", "O Chrome não conseguiu abrir o TikTok. Tente novamente aqui."]],
  ["Chrome no pudo preparar la pestaña. Reintenta abrir TikTok cuando esté disponible.", ["Chrome could not prepare the tab. Try opening TikTok when it is available.", "O Chrome não conseguiu preparar a aba. Tente abrir o TikTok quando estiver disponível."]],
  ["Abre MultiTikTok y concede el acceso a TikTok para continuar.", ["Open MultiTikTok and allow TikTok access to continue.", "Abra o MultiTikTok e permita o acesso ao TikTok para continuar."]],
  ["La sesión anterior está pendiente de restauración. Reintenta para recuperarla.", ["The previous session still needs to be restored. Retry to recover it.", "A sessão anterior ainda precisa ser restaurada. Tente novamente para recuperá-la."]],
  ["Abre MultiTikTok para consultar el estado de la sesión.", ["Open MultiTikTok to check the session.", "Abra o MultiTikTok para conferir a sessão."]]
]);

const patterns = [
  [/^Abrir (Perfil|Subir video|TikTok Studio) con «(.+)»$/, (section, alias) => {
    const [en, pt] = labels.get(section) ?? [section, section];
    return [`Open ${en} with “${alias}”`, `Abrir ${pt} com “${alias}”`];
  }],
  [/^Se simuló abrir (Perfil|Subir video|TikTok Studio)\.$/, (section) => {
    const [en, pt] = labels.get(section) ?? [section, section];
    return [`Simulated opening ${en}.`, `Abertura de ${pt} simulada.`];
  }],
  [/^Usar «(.+)» como alias$/, (alias) => [`Use “${alias}” as the alias`, `Usar “${alias}” como apelido`]],
  [/^Reconectar «(.+)»$/, (alias) => [`Reconnect “${alias}”`, `Reconectar “${alias}”`]],
  [/^Accesos rápidos de «(.+)»$/, (alias) => [`Quick links for “${alias}”`, `Atalhos de “${alias}”`]],
  [/^Confirmada en TikTok (.+)$/, (handle) => [`Confirmed on TikTok as ${handle}`, `Confirmada no TikTok como ${handle}`]],
  [/^Se esperaba (.+) y TikTok muestra (.+)\.$/, (expected, actual) => [`Expected ${expected}, but TikTok shows ${actual}.`, `Esperávamos ${expected}, mas o TikTok mostra ${actual}.`]],
  [/^TikTok aún no confirma (.+)\.$/, (handle) => [`TikTok hasn't confirmed ${handle} yet.`, `O TikTok ainda não confirmou ${handle}.`]],
  [/^Posición (\d+) de (\d+)$/, (position, total) => [`Position ${position} of ${total}`, `Posição ${position} de ${total}`]],
  [/^(\d+) minutos$/, (n) => [`${n} minutes`, `${n} minutos`]],
  [/^¿Te sirvió cambiar a «(.+)»\? Una estrella ayuda a que más personas encuentren MultiTikTok\.$/, (alias) => [`Was switching to “${alias}” helpful? A star helps more people find MultiTikTok.`, `Foi útil trocar para “${alias}”? Uma estrela ajuda mais pessoas a encontrar o MultiTikTok.`]],
  [/^¿Te ahorró otro inicio de sesión\? Una estrella ayuda a que más personas encuentren MultiTikTok\.$/, () => ["Did this save you another sign-in? A star helps more people find MultiTikTok.", "Economizou um login? Uma estrela ajuda mais pessoas a encontrar o MultiTikTok."]],
  [/^(\d+) pestañas de TikTok abiertas$/, (n) => [`${n} TikTok tabs open`, `${n} abas do TikTok abertas`]],
  [/^Ir a la pestaña (\d+)$/, (n) => [`Go to tab ${n}`, `Ir para a aba ${n}`]],
  [/^Cambiar a (.+)$/, (alias) => [`Switch to ${alias}`, `Alternar para ${alias}`]],
  [/^Editar (.+)$/, (alias) => [`Edit ${alias}`, `Editar ${alias}`]],
  [/^Reconecta «(.+)»$/, (alias) => [`Reconnect “${alias}”`, `Reconecte “${alias}”`]],
  [/^Cambiando a «(.+)»…$/, (alias) => [`Switching to “${alias}”…`, `Alternando para “${alias}”…`]],
  [/^¿Borrar la copia de «(.+)»\?$/, (alias) => [`Delete the saved copy of “${alias}”?`, `Apagar a cópia de “${alias}”?`]]
];

let locale = "es";
const localized = new WeakMap();
const attributes = new WeakMap();
const excluded = "[data-no-translate], script, style, .account .name, .avatar, #active-handle";

export function setLocale(value) {
  locale = value === "en" || value === "pt" ? value : "es";
  document.documentElement.lang = locale;
}

export function translate(value) {
  if (typeof value !== "string" || locale === "es" || !value.trim()) return value;
  const key = value.trim();
  let pair = labels.get(key);
  if (!pair) {
    for (const [pattern, render] of patterns) {
      const match = pattern.exec(key);
      if (match) {
        pair = render(...match.slice(1));
        break;
      }
    }
  }
  return pair ? value.replace(key, () => pair[locale === "en" ? 0 : 1]) : value;
}

function translated(previous, value) {
  const source = previous?.rendered === value ? previous.source : value;
  return { source, rendered: translate(source) };
}

export function translateDom(root = document.body) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement?.closest(excluded)) continue;
    const next = translated(localized.get(node), node.data);
    localized.set(node, next);
    if (next.rendered !== node.data) node.data = next.rendered;
  }
  for (const element of root.querySelectorAll("[title], [aria-label], [placeholder]")) {
    if (element.closest(excluded)) continue;
    const known = attributes.get(element) ?? {};
    for (const name of ["title", "aria-label", "placeholder"]) {
      if (!element.hasAttribute(name)) continue;
      const value = element.getAttribute(name);
      const next = translated(known[name], value);
      known[name] = next;
      if (next.rendered !== value) element.setAttribute(name, next.rendered);
    }
    attributes.set(element, known);
  }
}
