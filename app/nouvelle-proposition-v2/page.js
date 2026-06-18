'use client'

import { useState, useMemo } from 'react'
import RoofMap from '../components/RoofMap'
import { KITS, AIDES, getKitById, getAideById, computeAideMontant } from '../../lib/catalogue'

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  fontSize: 16,
  border: '1px solid #d1d5db',
  borderRadius: 10,
  fontFamily: 'Inter, sans-serif',
  marginBottom: 16,
  background: '#fff',
}

const selectStyle = { ...inputStyle, appearance: 'auto' }

const labelStyle = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 6,
}

const sectionTitleStyle = {
  fontSize: 14,
  fontWeight: 700,
  color: '#0a1628',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  margin: '28px 0 14px',
  paddingBottom: 8,
  borderBottom: '2px solid #f0f0f0',
}

const DEFAULT_PROD_MENSUELLE = [271, 287, 314, 337, 356, 363, 370, 363, 347, 320, 290, 264]

export default function NouvellePropositionV2() {
  const [form, setForm] = useState({
    client_nom: '',
    client_adresse: '',
    client_ville: '',
    client_cp: '',
    ref: '',
    kit_id: KITS[0].id,
    puissance_kwc: KITS[0].puissance_kwc,
    modules: KITS[0].modules,
    module_wc: KITS[0].module_wc,
    batterie_kwh: KITS[0].batterie_kwh,
    onduleur: KITS[0].onduleur,
    prix_ttc: KITS[0].prix_ttc,
    aide_id: AIDES[0].id,
    azimut: '',
    inclinaison: '',
    surface: '',
    production_annuelle: '',
    irradiation: '1650',
    performance: '82',
    pertes: '18',
    consommation_annuelle_edf: '',
    note_interne: '',
  })

  const [photoFond, setPhotoFond] = useState(null)
  const [photoError, setPhotoError] = useState(null)
  const [roofMapBase64, setRoofMapBase64] = useState(null)

  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  const isCustomKit = form.kit_id === 'custom'
  const selectedAide = getAideById(form.aide_id)

  const aideMontant = useMemo(() => {
    const puissance = Number(form.puissance_kwc) || 0
    return computeAideMontant(selectedAide, puissance)
  }, [selectedAide, form.puissance_kwc])

  const prodTheorique = useMemo(() => {
    const kwc = parseFloat(form.puissance_kwc)
    const irr = parseFloat(form.irradiation)
    const perf = parseFloat(form.performance)
    if (!kwc || !irr || !perf) return null
    return Math.round(kwc * irr * (perf / 100))
  }, [form.puissance_kwc, form.irradiation, form.performance])

  const ecartProd = useMemo(() => {
    if (!prodTheorique || !form.production_annuelle) return null
    const saisi = parseFloat(form.production_annuelle)
    if (!saisi) return null
    return Math.abs(saisi - prodTheorique) / prodTheorique
  }, [prodTheorique, form.production_annuelle])

  const fullAddress = useMemo(() => {
    return [form.client_adresse, form.client_cp, form.client_ville]
      .filter((s) => s && s.trim())
      .join(', ')
  }, [form.client_adresse, form.client_cp, form.client_ville])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function handleKitChange(kitId) {
    const kit = getKitById(kitId)
    setForm((f) => ({
      ...f,
      kit_id: kitId,
      puissance_kwc: kit.puissance_kwc ?? f.puissance_kwc,
      modules: kit.modules ?? f.modules,
      module_wc: kit.module_wc ?? f.module_wc,
      batterie_kwh: kit.batterie_kwh ?? f.batterie_kwh,
      onduleur: kit.onduleur ?? f.onduleur,
      prix_ttc: kit.prix_ttc ?? f.prix_ttc,
    }))
  }

  function handleRoofResult(result) {
    if (!result) {
      setForm((f) => ({ ...f, azimut: '', inclinaison: '', surface: '' }))
      setRoofMapBase64(null)
      return
    }
    setForm((f) => ({
      ...f,
      azimut: String(result.azimut),
      inclinaison: String(result.inclinaison),
      surface: String(result.surface),
    }))
    // roof_map_base64 est renseigné via le bouton "Capturer la carte" dans RoofMap
    if (result.roof_map_base64 !== undefined) {
      setRoofMapBase64(result.roof_map_base64)
    }
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoError(null)
    if (!file.type.startsWith('image/')) {
      setPhotoError('Le fichier doit être une image')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setPhotoError('Image trop lourde (max 8 Mo)')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setPhotoFond({ dataUrl: reader.result, name: file.name })
    reader.onerror = () => setPhotoError('Impossible de lire cette image')
    reader.readAsDataURL(file)
  }

  function buildProposalData() {
    const num = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v))

    return {
      ref: form.ref || `C2B-${Math.floor(100000 + Math.random() * 900000)}`,
      date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      client_nom: form.client_nom,
      client_ville: form.client_ville,
      puissance_kwc: num(form.puissance_kwc),
      modules: num(form.modules),
      module_wc: num(form.module_wc),
      batterie_kwh: num(form.batterie_kwh),
      onduleur: form.onduleur,
      prix_ttc: num(form.prix_ttc),
      aide_kap: aideMontant,
      production_annuelle: num(form.production_annuelle),
      production_mensuelle: DEFAULT_PROD_MENSUELLE,
      azimut: form.azimut ? `${form.azimut}°` : undefined,
      inclinaison: form.inclinaison ? `${form.inclinaison}°` : undefined,
      surface: form.surface ? `${form.surface} m²` : undefined,
      irradiation: num(form.irradiation),
      performance: num(form.performance),
      pertes: num(form.pertes),
      consommation_annuelle_edf: form.consommation_annuelle_edf ? num(form.consommation_annuelle_edf) : null,
      photo_fond_base64: photoFond?.dataUrl || null,
      roof_map_base64: roofMapBase64 || null,
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('loading')
    setError(null)

    try {
      const proposalData = buildProposalData()

      const res = await fetch('/api/generate-pdf-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proposalData),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Erreur lors de la génération du PDF')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const safeName = (form.client_nom || 'client').toLowerCase().replace(/\s+/g, '_')
      a.download = `proposition_v2_${safeName}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      setStatus('done')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px 60px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0a1628' }}>
          Nouvelle proposition
        </h1>
        <span style={{
          fontSize: 11, fontWeight: 700, background: '#d1fae5', color: '#059669',
          padding: '3px 8px', borderRadius: 12,
        }}>V2 — bêta</span>
      </div>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
        Thème clair 4 pages — Score Solaire — Carte toiture exportable.
      </p>

      <form onSubmit={handleSubmit}>
        {/* ── CLIENT ── */}
        <div style={sectionTitleStyle}>Client</div>

        <label style={labelStyle}>Nom du client *</label>
        <input
          style={inputStyle}
          required
          value={form.client_nom}
          onChange={(e) => update('client_nom', e.target.value)}
          placeholder="Nicolas GUILLOT"
        />

        <label style={labelStyle}>Adresse *</label>
        <input
          style={inputStyle}
          required
          value={form.client_adresse}
          onChange={(e) => update('client_adresse', e.target.value)}
          placeholder="36 B Rue des canneliers"
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Code postal *</label>
            <input
              style={inputStyle}
              required
              value={form.client_cp}
              onChange={(e) => update('client_cp', e.target.value)}
              placeholder="97436"
            />
          </div>
          <div>
            <label style={labelStyle}>Ville / commune *</label>
            <input
              style={inputStyle}
              required
              value={form.client_ville}
              onChange={(e) => update('client_ville', e.target.value)}
              placeholder="Saint-Leu"
            />
          </div>
        </div>

        <label style={labelStyle}>Référence (optionnel)</label>
        <input
          style={inputStyle}
          value={form.ref}
          onChange={(e) => update('ref', e.target.value)}
          placeholder="C2B-752992"
        />

        {/* ── KIT ── */}
        <div style={sectionTitleStyle}>Kit technique</div>

        <label style={labelStyle}>Choisir un kit *</label>
        <select
          style={selectStyle}
          value={form.kit_id}
          onChange={(e) => handleKitChange(e.target.value)}
        >
          {KITS.map((kit) => (
            <option key={kit.id} value={kit.id}>{kit.label}</option>
          ))}
        </select>

        <div style={{
          background: '#f8f9fa', borderRadius: 10, padding: 14, marginBottom: 16,
          fontSize: 13, color: '#374151',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 8, color: '#0a1628' }}>
            Détail technique {isCustomKit ? '(modifiable)' : '(défini par le kit)'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Puissance (kWc)</label>
              <input
                type="number" step="0.01" inputMode="decimal"
                disabled={!isCustomKit}
                value={form.puissance_kwc ?? ''}
                onChange={(e) => update('puissance_kwc', e.target.value)}
                style={{ ...inputStyle, marginBottom: 0, background: isCustomKit ? '#fff' : '#eee', fontSize: 14, padding: '8px 10px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Modules</label>
              <input
                type="number" inputMode="numeric"
                disabled={!isCustomKit}
                value={form.modules ?? ''}
                onChange={(e) => update('modules', e.target.value)}
                style={{ ...inputStyle, marginBottom: 0, background: isCustomKit ? '#fff' : '#eee', fontSize: 14, padding: '8px 10px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Batterie (kWh)</label>
              <input
                type="number" step="0.01" inputMode="decimal"
                disabled={!isCustomKit}
                value={form.batterie_kwh ?? ''}
                onChange={(e) => update('batterie_kwh', e.target.value)}
                style={{ ...inputStyle, marginBottom: 0, background: isCustomKit ? '#fff' : '#eee', fontSize: 14, padding: '8px 10px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Onduleur</label>
              <input
                disabled={!isCustomKit}
                value={form.onduleur ?? ''}
                onChange={(e) => update('onduleur', e.target.value)}
                style={{ ...inputStyle, marginBottom: 0, background: isCustomKit ? '#fff' : '#eee', fontSize: 14, padding: '8px 10px' }}
              />
            </div>
          </div>
          <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginTop: 10, marginBottom: 4 }}>Prix total TTC (€)</label>
          <input
            type="number" step="0.01" inputMode="decimal"
            disabled={!isCustomKit}
            value={form.prix_ttc ?? ''}
            onChange={(e) => update('prix_ttc', e.target.value)}
            style={{ ...inputStyle, marginBottom: 0, background: isCustomKit ? '#fff' : '#eee', fontSize: 14, padding: '8px 10px' }}
          />
        </div>

        {/* ── AIDES ── */}
        <div style={sectionTitleStyle}>Aide financière</div>

        <label style={labelStyle}>Choisir une aide *</label>
        <select
          style={selectStyle}
          value={form.aide_id}
          onChange={(e) => update('aide_id', e.target.value)}
        >
          {AIDES.map((aide) => (
            <option key={aide.id} value={aide.id}>{aide.label}</option>
          ))}
        </select>

        <div style={{
          background: '#f0fdf4', border: '1px solid #bbf0cf', borderRadius: 10,
          padding: 12, marginBottom: 16, fontSize: 13,
        }}>
          <div style={{ color: '#374151', marginBottom: 4 }}>{selectedAide?.description}</div>
          <div style={{ fontWeight: 700, color: '#15803d', fontSize: 16 }}>
            − {aideMontant.toLocaleString('fr-FR')} €
          </div>
        </div>

        {/* ── TOITURE ── */}
        <div style={sectionTitleStyle}>Toiture</div>

        <label style={{ ...labelStyle, marginBottom: 10 }}>
          Tracez le contour de la toiture sur la carte. Utilisez &quot;Capturer la carte&quot; pour inclure
          une photo satellite dans le PDF.
        </label>
        <RoofMap searchAddress={fullAddress} onResult={handleRoofResult} />

        {roofMapBase64 && (
          <div style={{
            marginTop: 8, marginBottom: 8, fontSize: 12, color: '#059669', fontWeight: 600,
            background: '#f0fdf4', padding: '6px 10px', borderRadius: 7, border: '1px solid #bbf7d0',
          }}>
            Carte capturée — incluse dans le PDF page 2
          </div>
        )}

        {(form.azimut || form.surface) && (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10,
            marginTop: 14, marginBottom: 16,
          }}>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Azimut</label>
              <div style={{ ...inputStyle, marginBottom: 0, background: '#eee', fontSize: 14, padding: '8px 10px' }}>
                {form.azimut}°
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Inclinaison</label>
              <div style={{ ...inputStyle, marginBottom: 0, background: '#eee', fontSize: 14, padding: '8px 10px' }}>
                {form.inclinaison}°
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Surface</label>
              <div style={{ ...inputStyle, marginBottom: 0, background: '#eee', fontSize: 14, padding: '8px 10px' }}>
                {form.surface} m²
              </div>
            </div>
          </div>
        )}

        {/* ── PRODUCTION ── */}
        <div style={sectionTitleStyle}>Production</div>

        <label style={labelStyle}>Production annuelle estimée (kWh/an) *</label>
        <input
          style={inputStyle}
          required
          type="number"
          inputMode="numeric"
          value={form.production_annuelle}
          onChange={(e) => update('production_annuelle', e.target.value)}
          placeholder="3964"
        />
        {prodTheorique && (
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: -10, marginBottom: 8 }}>
            Référence théorique : {prodTheorique.toLocaleString('fr-FR')} kWh/an
            ({form.puissance_kwc} kWc × {form.irradiation} kWh/kWc × {form.performance}%)
          </div>
        )}
        {ecartProd > 0.15 && (
          <div style={{
            fontSize: 12, color: '#dc2626', marginTop: -8, marginBottom: 14,
            background: '#fef2f2', padding: '8px 12px', borderRadius: 8,
          }}>
            Écart de {Math.round(ecartProd * 100)}% avec la référence théorique
            ({prodTheorique.toLocaleString('fr-FR')} kWh/an) — vérifiez la saisie
          </div>
        )}

        {/* ── EDF ── */}
        <div style={sectionTitleStyle}>Conso EDF (optionnel)</div>
        <label style={labelStyle}>Consommation annuelle relevée (kWh/an)</label>
        <input
          style={inputStyle}
          type="number"
          inputMode="numeric"
          value={form.consommation_annuelle_edf}
          onChange={(e) => update('consommation_annuelle_edf', e.target.value)}
          placeholder="Laisser vide si non disponible"
        />

        {/* ── PHOTO DE FOND ── */}
        <div style={sectionTitleStyle}>Photo de la maison</div>
        <label style={labelStyle}>
          Photo en arrière-plan subtil sur la couverture du PDF
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handlePhotoChange}
          style={{ ...inputStyle, padding: '10px 12px' }}
        />
        {photoError && (
          <div style={{ fontSize: 12, color: '#dc2626', marginTop: -10, marginBottom: 14 }}>{photoError}</div>
        )}
        {photoFond && (
          <div style={{ marginBottom: 16 }}>
            <img
              src={photoFond.dataUrl}
              alt="Aperçu"
              style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 10, border: '1px solid #d1d5db' }}
            />
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{photoFond.name}</div>
          </div>
        )}

        {/* ── NOTE INTERNE ── */}
        <div style={sectionTitleStyle}>Note interne</div>
        <label style={labelStyle}>
          Visible uniquement par vous — n&apos;apparaît jamais dans le PDF
        </label>
        <textarea
          value={form.note_interne}
          onChange={(e) => update('note_interne', e.target.value)}
          placeholder="Contexte du rendez-vous, points d'attention…"
          rows={4}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'Inter, sans-serif' }}
        />

        {/* ── ACTIONS ── */}
        {error && (
          <div style={{
            background: '#fef2f2', color: '#dc2626', fontSize: 13,
            padding: '10px 14px', borderRadius: 8, marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {status === 'done' && (
          <div style={{
            background: '#f0fdf4', color: '#15803d', fontSize: 13,
            padding: '10px 14px', borderRadius: 8, marginBottom: 16,
          }}>
            PDF V2 généré et téléchargé
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'loading'}
          style={{
            width: '100%',
            background: status === 'loading' ? '#94a3b8' : '#059669',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '16px',
            fontSize: 16,
            fontWeight: 600,
            fontFamily: 'Inter, sans-serif',
            cursor: status === 'loading' ? 'not-allowed' : 'pointer',
            marginTop: 8,
          }}
        >
          {status === 'loading' ? 'Génération en cours…' : 'Générer le PDF V2'}
        </button>
      </form>
    </div>
  )
}
