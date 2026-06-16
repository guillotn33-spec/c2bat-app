'use client'

import { useState } from 'react'

export default function DownloadPdfButton({ proposalData, label = 'Télécharger le PDF' }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleDownload() {
    setLoading(true)
    setError(null)
    try {
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
      a.download = `proposition_${(proposalData.client_nom || 'client').replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleDownload}
        disabled={loading}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: loading ? '#94a3b8' : '#0a1628',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          padding: '12px 22px',
          fontSize: 14,
          fontWeight: 500,
          fontFamily: 'Inter, sans-serif',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s',
        }}
      >
        {loading ? 'Génération en cours…' : `📄 ${label}`}
      </button>
      {error && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#dc2626' }}>
          ⚠ {error}
        </div>
      )}
    </div>
  )
}
