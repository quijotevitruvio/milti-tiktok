const hostName = "io.github.quijotevitruvio.multitiktok";

export async function askHost(message) {
  let reply;
  try {
    reply = await chrome.runtime.sendNativeMessage(hostName, message);
  } catch (error) {
    if (error.message.includes("host not found") || error.message.includes("not found")) {
      return { ok: false, error: "missing_host" };
    }
    if (error.message.includes("forbidden")) {
      return { ok: false, error: "blocked_host" };
    }
    return { ok: false, error: "unavailable_host" };
  }
  return reply ?? { ok: false, error: "unavailable_host" };
}

export function describeError(code) {
  switch (code) {
    case "missing_host":
      return "Instala el componente de Windows con el ID de esta extensión y vuelve a actualizar.";
    case "blocked_host":
      return "El componente de Windows no reconoce esta instalación. Regístralo con el ID de la extensión.";
    case "profile_unavailable":
      return "Este perfil ya no está disponible. Actualiza la lista o desvincúlalo.";
    case "profiles_unreadable":
      return "No se pudieron leer los perfiles. Abre Chrome con su configuración habitual y actualiza.";
    case "chrome_unavailable":
      return "No se pudo abrir Chrome. Comprueba que Google Chrome esté instalado.";
    case "switch_busy":
      return "Espera a que termine de abrirse el perfil anterior.";
    case "history_unavailable":
      return "Chrome recibió la solicitud, pero no se pudo guardar el historial del cambio.";
    default:
      return "El componente de Windows no respondió. Comprueba la instalación y vuelve a intentar.";
  }
}
