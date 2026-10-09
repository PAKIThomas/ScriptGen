// Onglet « Paramètres » : les globals de configuration (registre src/model/registry.ts).
import { useState } from 'react';
import { CATEGORIES, PARAMS, type CategoryId, type ParamDef } from '../model/registry';
import type { LuaValue } from '../model/types';
import type { ProjectStore } from '../state';
import { EquipmentCard } from './AutomationPanel';
import { HoursPicker, ItemPicker, MonsterAmountsEditor, MonsterPicker, ResourcePicker } from './pickers';

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function ParamEditor({ def, value, onChange }: { def: ParamDef; value: LuaValue; onChange: (v: LuaValue) => void }) {
  switch (def.type) {
    case 'number':
      return (
        <div className="row">
          <input
            type="number" min={def.min} max={def.max}
            value={typeof value === 'number' ? value : ''}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          {def.unit && <span className="muted">{def.unit}</span>}
        </div>
      );
    case 'bool':
      return (
        <label className="check">
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          {value === true ? 'oui (true)' : 'non (false)'}
        </label>
      );
    case 'string':
      return <input className="wide" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />;
    case 'resources':
      return <ResourcePicker value={(Array.isArray(value) ? value : []) as number[]} onChange={onChange} />;
    case 'monsters':
      return <MonsterPicker value={(Array.isArray(value) ? value : []) as (number | string)[]} onChange={onChange} />;
    case 'items':
      return <ItemPicker value={(Array.isArray(value) ? value : []) as number[]} onChange={onChange} />;
    case 'hours':
      return <HoursPicker value={(Array.isArray(value) ? value : []) as number[]} onChange={onChange} />;
    case 'monsterAmounts':
      return <MonsterAmountsEditor value={(Array.isArray(value) ? value : []) as number[][]} onChange={onChange} />;
  }
}

export function ParamsPanel({ store }: { store: ProjectStore }) {
  const { project, update } = store;
  const [category, setCategory] = useState<CategoryId | 'all' | 'equipment'>('all');
  const [query, setQuery] = useState('');

  const q = normalize(query.trim());
  const visible = PARAMS.filter((p) => (category === 'all' || p.category === category)
    && (!q || normalize(`${p.key} ${p.label} ${p.help}`).includes(q)));

  return (
    <div className="overlay-panel params-panel">
      <nav className="params-nav">
        <input placeholder="Rechercher un paramètre…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="button" className={category === 'all' ? 'on' : ''} onClick={() => setCategory('all')}>Tous</button>
        {CATEGORIES.map((c) => {
          const active = PARAMS.filter((p) => p.category === c.id && p.key in project.globals).length;
          return (
            <button key={c.id} type="button" className={category === c.id ? 'on' : ''} onClick={() => setCategory(c.id)}>
              {c.label}{active ? <span className="count">{active}</span> : null}
            </button>
          );
        })}
        <button type="button" className={category === 'equipment' ? 'on' : ''} onClick={() => setCategory('equipment')}>
          Équipement{project.automation?.autoStuff || project.automation?.equip.length ? <span className="count">✓</span> : null}
        </button>
        <p className="muted small">
          Un paramètre décoché n'est pas écrit dans le script : le bot applique alors sa valeur par défaut.
          Les réglages par palier (récolte, monstres) se font dans l'onglet Trajet.
        </p>
      </nav>
      <div className="params-list">
        {(category === 'equipment' || category === 'all') && !q && <EquipmentCard store={store} />}
        {category !== 'equipment' && visible.map((def) => {
          const enabled = def.key in project.globals;
          return (
            <section key={def.key} className={`param${enabled ? ' enabled' : ''}`}>
              <header>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => update((p) => {
                      if (e.target.checked) p.globals[def.key] = structuredClone(def.initial) as LuaValue;
                      else delete p.globals[def.key];
                    })}
                  />
                  <strong>{def.label}</strong>
                </label>
                <code>{def.key}</code>
              </header>
              <p className="muted small">{def.help} <em>Par défaut : {def.engineDefault}.</em></p>
              {enabled && (
                <ParamEditor
                  def={def}
                  value={project.globals[def.key]}
                  onChange={(v) => update((p) => { p.globals[def.key] = v; })}
                />
              )}
            </section>
          );
        })}
        {category !== 'equipment' && visible.length === 0 && <p className="muted">Aucun paramètre ne correspond.</p>}
      </div>
    </div>
  );
}
