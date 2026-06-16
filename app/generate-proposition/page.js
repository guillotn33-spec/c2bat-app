'use client'

import { useState } from 'react'

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

export default function NouvelleProposition() {
  const [form, setForm] = useState({
    // Client
    client_nom: '',
    client_ville: '',
    ref: '',
    // Kit
    puissance_kwc: '',
    modules: '',
    module_wc: '585',
    batterie_kwh: '',
    onduleur: 'ESI 3K-S1',
    // Prix
    prix_ttc: '',
    aide_kap: '6000',
    // Production / toiture
    production_annuelle: '',
    azimut: '',
    inclinaison: '',
    surface: '',
    irradiation: '1650',
    performance: '82',
    pertes: '18',
    // EDF (optionnel)
    consommation_annuelle_edf: '',
  })

  const [status, setStatus] = useState('idle') // idle | loading | error | done
  const [error, setError] = useState(null)

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function buildProposalData() {
    const num = (v) => (v === '' || v === null ? undefined : Number(v))

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
      aide_kap: num(form.aide_kap),
      production_annuelle: num(form.production_annuelle),
      production_mensuelle: DEFAULT_PROD_MENSUELLE, // pourra être affiné plus tard (étude PVGIS réelle)
      azimut: form.azimut ? `${form.azimut}°` : undefined,
      inclinaison: form.inclinaison ? `${form.inclinaison}°` : undefined,
      surface: form.surface ? `${form.surface} m²` : undefined,
      irradiation: num(form.irradiation),
      performance: num(form.performance),
      pertes: num(form.pertes),
      consommation_annuelle_edf: form.consommation_annuelle_edf ? num(form.consommation_annuelle_edf) : null,
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('loading')
    setError(null)

    try {
      const proposalData = buildProposalData()

      const res = await fetch('/api/generate-pdf', {
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
      a.download = `proposition_${safeName}.pdf`
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
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0a1628', marginBottom: 4 }}>
        Nouvelle proposition
      </h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
        Renseignez les informations du projet pour générer le PDF.
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

        <label style={labelStyle}>Ville / commune *</label>
        <input
          style={inputStyle}
          required
          value={form.client_ville}
          onChange={(e) => update('client_ville', e.target.value)}
          placeholder="Saint-Leu, La Réunion"
        />

        <label style={labelStyle}>Référence (optionnel, auto-générée sinon)</label>
        <input
          style={inputStyle}
          value={form.ref}
          onChange={(e) => update('ref', e.target.value)}
          placeholder="C2B-752992"
        />

        {/* ── KIT ── */}
        <div style={sectionTitleStyle}>Kit installé</div>

        <label style={labelStyle}>Puissance installée (kWc) *</label>
        <input
          style={inputStyle}
          required
          type="number"
          step="0.01"
          inputMode="decimal"
          value={form.puissance_kwc}
          onChange={(e) => update('puissance_kwc', e.target.value)}
          placeholder="2.93"
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Nombre de modules *</label>
            <input
              style={inputStyle}
              required
              type="number"
              inputMode="numeric"
              value={form.modules}
              onChange={(e) => update('modules', e.target.value)}
              placeholder="5"
            />
          </div>
          <div>
            <label style={labelStyle}>Puissance module (Wc)</label>
            <input
              style={inputStyle}
              type="number"
              inputMode="numeric"
              value={form.module_wc}
              onChange={(e) => update('module_wc', e.target.value)}
              placeholder="585"
            />
          </div>
        </div>

        <label style={labelStyle}>Batterie (kWh) *</label>
        <input
          style={inputStyle}
          required
          type="number"
          step="0.01"
          inputMode="decimal"
          value={form.batterie_kwh}
          onChange={(e) => update('batterie_kwh', e.target.value)}
          placeholder="9.98"
        />

        <label style={labelStyle}>Onduleur</label>
        <input
          style={inputStyle}
          value={form.onduleur}
          onChange={(e) => update('onduleur', e.target.value)}
          placeholder="ESI 3K-S1"
        />

        {/* ── PRIX ── */}
        <div style={sectionTitleStyle}>Prix & aides</div>

        <label style={labelStyle}>Prix total TTC (€) *</label>
        <input
          style={inputStyle}
          required
          type="number"
          step="0.01"
          inputMode="decimal"
          value={form.prix_ttc}
          onChange={(e) => update('prix_ttc', e.target.value)}
          placeholder="12496.70"
        />

        <label style={labelStyle}>Aide Kap PV (€)</label>
        <input
          style={inputStyle}
          type="number"
          step="0.01"
          inputMode="decimal"
          value={form.aide_kap}
          onChange={(e) => update('aide_kap', e.target.value)}
          placeholder="6000"
        />

        {/* ── PRODUCTION / TOITURE ── */}
        <div style={sectionTitleStyle}>Production & toiture</div>

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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Azimut (°)</label>
            <input
              style={inputStyle}
              type="number"
              inputMode="numeric"
              value={form.azimut}
              onChange={(e) => update('azimut', e.target.value)}
              placeholder="324"
            />
          </div>
          <div>
            <label style={labelStyle}>Inclinaison (°)</label>
            <input
              style={inputStyle}
              type="number"
              inputMode="numeric"
              value={form.inclinaison}
              onChange={(e) => update('inclinaison', e.target.value)}
              placeholder="20"
            />
          </div>
        </div>

        <label style={labelStyle}>Surface toiture utile (m²)</label>
        <input
          style={inputStyle}
          type="number"
          inputMode="numeric"
          value={form.surface}
          onChange={(e) => update('surface', e.target.value)}
          placeholder="50"
        />

        {/* ── EDF optionnel ── */}
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

        {/* ── ACTIONS ── */}
        {error && (
          <div style={{
            background: '#fef2f2', color: '#dc2626', fontSize: 13,
            padding: '10px 14px', borderRadius: 8, marginBottom: 16,
          }}>
            ⚠ {error}
          </div>
        )}

        {status === 'done' && (
          <div style={{
            background: '#f0fdf4', color: '#15803d', fontSize: 13,
            padding: '10px 14px', borderRadius: 8, marginBottom: 16,
          }}>
            ✓ PDF généré et téléchargé
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'loading'}
          style={{
            width: '100%',
            background: status === 'loading' ? '#94a3b8' : '#0a1628',
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
          {status === 'loading' ? 'Génération en cours…' : '📄 Générer le PDF'}
        </button>
      </form>
    </div>
  )
}
