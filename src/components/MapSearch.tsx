// Recherche d'une carte dans le référentiel : par id, par coordonnées « x,y » ou par sous-zone.
// Sert surtout aux intérieurs (mines, donjons, maisons), qu'on ajoute par leur id.
import { useMemo, useState } from 'react';
import { MAIN_WORLD, mapImageUrl, WORLD_NAMES, type MapIndex, type MapInfo } from '../data/maps';

interface Props {
  index: MapIndex | null;
  onAdd: (map: string | number, info: MapInfo) => void;
  onClose: () => void;
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function searchMaps(index: MapIndex, query: string, interiorsOnly: boolean, limit = 80): MapInfo[] {
  const q = query.trim();
  if (!q) return [];
  let found: MapInfo[];
  const coords = /^(-?\d+)\s*[,; ]\s*(-?\d+)$/.exec(q);
  if (coords) {
    const x = Number(coords[1]);
    const y = Number(coords[2]);
    found = index.maps.filter((m) => m.x === x && m.y === y);
  } else if (/^\d+$/.test(q)) {
    found = index.maps.filter((m) => String(m.id).startsWith(q));
  } else {
    const nq = normalize(q);
    found = index.maps.filter((m) => normalize(`${index.subAreaName(m.subAreaId)} ${index.areaName(m.subAreaId)}`).includes(nq));
  }
  if (interiorsOnly) found = found.filter((m) => !m.outdoor || m.worldMap !== MAIN_WORLD);
  return found.slice(0, limit);
}

export function MapSearch({ index, onAdd, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [interiorsOnly, setInteriorsOnly] = useState(false);
  const [preview, setPreview] = useState<MapInfo | null>(null);
  const results = useMemo(() => (index ? searchMaps(index, query, interiorsOnly) : []), [index, query, interiorsOnly]);

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog wide-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Chercher une carte</h2>
        <div className="row">
          <input
            autoFocus
            className="grow"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="id de carte, coordonnées « 4,-18 » ou nom de sous-zone (ex. « Mine », « Banque »)"
          />
          <label className="check">
            <input type="checkbox" checked={interiorsOnly} onChange={(e) => setInteriorsOnly(e.target.checked)} />
            Intérieurs seulement
          </label>
        </div>
        {!index && <p className="muted">Chargement du référentiel des cartes…</p>}
        <div className="map-search">
          <ul className="map-results">
            {results.map((m) => (
              <li
                key={m.id}
                className={preview?.id === m.id ? 'active' : ''}
                onMouseEnter={() => setPreview(m)}
                onClick={() => setPreview(m)}
              >
                <div>
                  <strong>{m.id}</strong> <span className="muted">[{m.x},{m.y}]</span>{' '}
                  {!m.outdoor && <span className="tag">intérieur</span>}
                  {m.worldMap !== MAIN_WORLD && m.worldMap !== -1 && <span className="tag">{WORLD_NAMES[m.worldMap] ?? `monde ${m.worldMap}`}</span>}
                  <div className="muted small">{index!.subAreaName(m.subAreaId)} — {index!.areaName(m.subAreaId)}</div>
                </div>
                <div className="row">
                  {m.worldMap === MAIN_WORLD && m.outdoor && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); onAdd(`${m.x},${m.y}`, m); }} title="Écrit map = &quot;x,y&quot;">
                      + par x,y
                    </button>
                  )}
                  <button type="button" className="primary" onClick={(e) => { e.stopPropagation(); onAdd(m.id, m); }} title="Écrit map = id">
                    + par id
                  </button>
                </div>
              </li>
            ))}
            {index && query && results.length === 0 && <li className="muted">Aucune carte trouvée.</li>}
          </ul>
          <div className="map-preview">
            {preview ? (
              <>
                <img src={mapImageUrl(preview.id, '0.5')} alt={`Carte ${preview.id}`} />
                <p className="small">
                  <strong>{preview.id}</strong> · [{preview.x},{preview.y}] · {index?.subAreaName(preview.subAreaId)}
                </p>
              </>
            ) : <p className="muted small">Survole un résultat pour voir la carte (image DofusDB).</p>}
          </div>
        </div>
        <p className="muted small">
          Conseil (guide MizanBot §7.5) : une carte d'extérieur s'écrit en « x,y » ; un intérieur (mine, donjon, banque…)
          partage les coordonnées de l'extérieur, il faut donc son id. Données : api.dofusdb.fr.
        </p>
        <div className="row end"><button type="button" onClick={onClose}>Fermer</button></div>
      </div>
    </div>
  );
}
