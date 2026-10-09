// Blocs Lua générés pour les automatismes et les hooks. Chaque bloc est entièrement déterminé par
// les réglages du projet : à l'import, on régénère le bloc et on le compare au texte du fichier
// (même texte = reconnu et éditable, sinon il reste en « Lua brut »).
import type { Automation, FightEndHook, StoppedHook } from '../model/types';
import { luaString } from './serialize';

export const AUTOMATION_START = '-- ▶ ScriptGen : automatismes';
export const AUTOMATION_END = '-- ■ ScriptGen : automatismes';
/** Première ligne de move() quand des automatismes sont actifs. */
export const TICK_CALL = 'if not scriptgenTick() then return false end';

function combatLines(a: Automation): string[] {
  const c = a.combat;
  const out: string[] = [];
  if (c.autoFight !== undefined) out.push(`combat:setAutoFight(${c.autoFight})`);
  if (c.style) out.push(`combat:setStyle(${luaString(c.style)})`);
  if (c.target) out.push(`combat:setTargetMode(${luaString(c.target)})`);
  if (c.speed) out.push(`combat:setSpeed(${luaString(c.speed)})`);
  if (c.kiteMin !== undefined) out.push(`combat:setKiteRange(${c.kiteMin}, ${c.kiteMax ?? 0})`);
  if (c.maxCasts !== undefined) out.push(`combat:setMaxCasts(${c.maxCasts})`);
  if (c.finishKill !== undefined) out.push(`combat:setFinishKill(${c.finishKill})`);
  if (c.autoPreFight !== undefined) out.push(`combat:setAutoPreFight(${c.autoPreFight})`);
  if (c.challengeMode) out.push(`combat:setChallengeMode(${luaString(c.challengeMode)})`);
  return out;
}

export function hasAutomation(a: Automation | null | undefined): a is Automation {
  if (!a) return false;
  return a.equip.length > 0 || !!a.autoStat || combatLines(a).length > 0 || !!a.privateStatus
    || !!a.archNotify || !!a.stopAt;
}

/** Réglages encodés en JSON dans le commentaire d'ouverture (pour relire le bloc à l'import). */
function settingsComment(a: Automation): string {
  return `${AUTOMATION_START} ${JSON.stringify(a)}`;
}

export function generateAutomation(a: Automation): string {
  const once = [...combatLines(a), ...(a.privateStatus ? ['setPrivate(true)'] : [])];
  const L: string[] = [settingsComment(a)];
  if (a.equip.length) {
    const rows = [...a.equip].sort((x, y) => x.level - y.level).map((e) => `{ level = ${e.level}, gid = ${e.gid} }`);
    L.push(`local SCRIPTGEN_EQUIP = { ${rows.join(', ')} }`);
  }
  if (once.length) L.push('local scriptgenStarted = false');
  if (a.equip.length) L.push('local scriptgenLevel = -1');
  if (a.archNotify) L.push('local scriptgenArchiMap = 0');
  L.push('', 'local function scriptgenTick()');
  if (once.length) {
    L.push('  if not scriptgenStarted then', '    scriptgenStarted = true');
    for (const line of once) L.push(`    ${line}`);
    L.push('  end');
  }
  if (a.stopAt) {
    const expr = a.stopAt.jobId ? `getJobLevel(${a.stopAt.jobId})` : 'getCharacterLevel()';
    L.push(
      `  if ${expr} >= ${a.stopAt.level} then`,
      `    printSuccess(${luaString(`Niveau ${a.stopAt.level} atteint : arrêt du script`)})`,
      '    return false',
      '  end',
    );
  }
  if (a.equip.length) {
    L.push(
      '  local level = getCharacterLevel()',
      '  if level ~= scriptgenLevel then',
      '    scriptgenLevel = level',
      '    for _, e in ipairs(SCRIPTGEN_EQUIP) do',
      '      if level >= e.level and inventory:itemPosition(e.gid) == 63 then',
      '        inventory:equip(e.gid)',
      '      end',
      '    end',
      '  end',
    );
  }
  if (a.autoStat) {
    L.push(
      '  if character:statPoints() > 0 then',
      `    character:upgradeStat(${luaString(a.autoStat)}, character:statPoints())`,
      '  end',
    );
  }
  if (a.archNotify) {
    L.push(
      '  if map:containsArchi() and getMapId() ~= scriptgenArchiMap then',
      '    scriptgenArchiMap = getMapId()',
      '    notify("Archimonstre repéré en " .. getCurrentPos())',
      '  end',
    );
  }
  L.push('  return true', 'end', AUTOMATION_END);
  return L.join('\n');
}

/** Relit les réglages d'un bloc d'automatismes ; null si le texte n'est pas exactement celui généré. */
export function parseAutomationBlock(text: string): Automation | null {
  const first = text.split('\n')[0];
  if (!first.startsWith(`${AUTOMATION_START} `)) return null;
  try {
    const a = JSON.parse(first.slice(AUTOMATION_START.length + 1)) as Automation;
    if (!a || !Array.isArray(a.equip) || typeof a.combat !== 'object') return null;
    return generateAutomation(a) === text ? a : null;
  } catch {
    return null;
  }
}

export function generateFightEnd(hook: FightEndHook): string {
  const body: string[] = [];
  if (hook.openBagsOnWin) body.push('  if result.won then', '    openBags()', '  end');
  if (hook.notifyOnLoss) body.push('  if result.lost then', '    notify("Combat perdu")', '  end');
  return ['function onFightEnd(result)', ...body, 'end'].join('\n');
}

export function hasFightEnd(hook: FightEndHook | null | undefined): hook is FightEndHook {
  return !!hook && (hook.openBagsOnWin || !!hook.notifyOnLoss);
}

export const FIGHT_END_VARIANTS: FightEndHook[] = [
  { openBagsOnWin: true },
  { openBagsOnWin: false, notifyOnLoss: true },
  { openBagsOnWin: true, notifyOnLoss: true },
];

export function generateStopped(hook: StoppedHook): string {
  return hook.notify
    ? ['function stopped(reason)', '  notify("Script arrêté : " .. reason)', 'end'].join('\n')
    : '';
}
