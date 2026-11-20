const demoAccounts = [
  { id: "demo-personal", alias: "Alex", handle: "@alex.ejemplo", color: "#25f4ee", favorite: true },
  { id: "demo-studio", alias: "Studio Luna", handle: "@studioluna.ejemplo", color: "#fe748e", group: "Studio", requireConfirm: true },
  { id: "demo-team", alias: "Equipo Luna", handle: "@equipoluna.ejemplo", color: "#b7a2ff", group: "Studio" }
];

export function demoModel(locale) {
  return {
    allowed: true,
    unlocked: true,
    active: demoAccounts[0].id,
    identity: { handle: demoAccounts[0].handle },
    accounts: demoAccounts,
    settings: { locale, density: "compact" }
  };
}

export function demoChange(model, id) {
  const selected = model.accounts.find((account) => account.id === id);
  if (!selected || id === model.active) return model;
  return {
    ...model,
    active: id,
    previous: model.active,
    identity: { handle: selected.handle },
    verification: {
      status: "verified", expected: selected.handle, actual: selected.handle,
      accountId: id, previousId: model.active
    }
  };
}
