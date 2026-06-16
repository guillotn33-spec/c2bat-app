'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Carte interactive (Leaflet + OpenStreetMap, gratuit, sans clé API).
 *
 * Le centrage se fait automatiquement à partir de `searchAddress` (adresse +
 * ville + code postal saisis dans le formulaire parent). Un bouton de secours
 * "Localiser" permet de relancer la recherche si l'auto-géocodage échoue ou
 * si l'adresse a changé sans déclencher la recherche automatique.
 *
 * Le commercial clique ensuite sur la carte pour tracer le contour de la
 * toiture (polygone). On en déduit :
 * - la surface (formule de Shoelace, projetée en mètres)
 * - l'azimut (orientation du plus long côté du polygone, par rapport au nord)
 * - l'inclinaison reste une estimation déclarative (non mesurable depuis une vue aérienne)
 *
 * onResult(data) est appelé avec { azimut, surface, lat, lng, inclinaison } à
 * chaque mise à jour du polygone.
 */
export default function RoofMap({ searchAddress, onResult }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const drawnPointsRef = useRef([])
  const polygonRef = useRef(null)
  const markersRef = useRef([])
  const leafletRef = useRef(null)
  const lastGeocodedRef = useRef('')

  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [polygonInfo, setPolygonInfo] = useState(null)
  const [drawing, setDrawing] = useState(false)
  const [inclinaison, setInclinaison] = useState(20)

  // ── Chargement de Leaflet (CSS + JS) dynamiquement, uniquement côté client ──
  useEffect(() => {
    let cancelled = false

    async function loadLeaflet() {
      if (typeof window === 'undefined') return

      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link')
        link.id = 'leaflet-css'
        link.rel = 'stylesheet'
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
        document.head.appendChild(link)
      }

      if (!window.L) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
          script.onload = resolve
          script.onerror = reject
          document.body.appendChild(script)
        })
      }

      if (cancelled) return
      leafletRef.current = window.L
      initMap()
    }

    function initMap() {
      if (!mapRef.current || mapInstanceRef.current) return
      const L = leafletRef.current

      const map = L.map(mapRef.current, {
        center: [-21.1151, 55.2839], // La Réunion par défaut
        zoom: 18,
        maxZoom: 19,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      mapInstanceRef.current = map

      // Si une adresse était déjà fournie avant que la carte soit prête
      if (searchAddress && searchAddress.trim()) {
        geocode(searchAddress)
      }
    }

    loadLeaflet()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-bind le handler de clic quand `drawing` change (closure stale sinon)
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    const handler = (e) => { if (drawing) addPoint(e.latlng) }
    map.on('click', handler)
    return () => map.off('click', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing])

  // Géocodage automatique dès que l'adresse complète change (debounce léger)
  useEffect(() => {
    if (!searchAddress || !searchAddress.trim()) return
    if (searchAddress === lastGeocodedRef.current) return
    if (!mapInstanceRef.current) return // la carte initiale gère ce cas au montage

    const timeout = setTimeout(() => geocode(searchAddress), 800)
    return () => clearTimeout(timeout)
  }, [searchAddress])

  async function geocode(query) {
    if (!query || !query.trim()) return
    setSearching(true)
    setSearchError(null)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
        { headers: { 'Accept-Language': 'fr' } }
      )
      const results = await res.json()
      if (!results.length) throw new Error('Adresse introuvable, ajustez la carte manuellement')
      const { lat, lon } = results[0]
      mapInstanceRef.current.setView([parseFloat(lat), parseFloat(lon)], 19)
      lastGeocodedRef.current = query
    } catch (err) {
      setSearchError(err.message || 'Erreur de géocodage')
    } finally {
      setSearching(false)
    }
  }

  function handleManualLocate() {
    geocode(searchAddress)
  }

  // ── Icône flèche fine noire (remplace le point cyan) ──
  function arrowIcon(L) {
    return L.divIcon({
      className: 'roofmap-arrow-icon',
      html: `<svg width="22" height="22" viewBox="0 0 24 24" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4))">
        <path d="M12 2 L12 20 M12 2 L7 8 M12 2 L17 8" stroke="#111111" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      iconSize: [22, 22],
      iconAnchor: [11, 18],
    })
  }

  function addPoint(latlng) {
    const L = leafletRef.current
    const map = mapInstanceRef.current
    drawnPointsRef.current.push(latlng)

    const marker = L.marker(latlng, { icon: arrowIcon(L) }).addTo(map)
    markersRef.current.push(marker)

    redrawPolygon()
  }

  function redrawPolygon() {
    const L = leafletRef.current
    const map = mapInstanceRef.current
    const points = drawnPointsRef.current

    if (polygonRef.current) {
      map.removeLayer(polygonRef.current)
      polygonRef.current = null
    }

    if (points.length >= 2) {
      polygonRef.current = L.polygon(points, {
        color: '#22d3ee',
        weight: 2,
        fillColor: '#22d3ee',
        fillOpacity: 0.2,
      }).addTo(map)
    }

    if (points.length >= 3) {
      const info = computePolygon(points)
      setPolygonInfo(info)
      onResult?.({ ...info, inclinaison })
    } else {
      setPolygonInfo(null)
    }
  }

  function resetPolygon() {
    const map = mapInstanceRef.current
    if (polygonRef.current) { map.removeLayer(polygonRef.current); polygonRef.current = null }
    markersRef.current.forEach((m) => map.removeLayer(m))
    markersRef.current = []
    drawnPointsRef.current = []
    setPolygonInfo(null)
    onResult?.(null)
  }

  // ── Calcul géométrique : surface (m²) + azimut (° depuis le nord) ──
  function computePolygon(points) {
    const R = 6378137 // rayon terrestre en m
    const lat0 = points[0].lat * Math.PI / 180

    // Projection équirectangulaire locale (suffisant à l'échelle d'une toiture)
    const xy = points.map((p) => {
      const x = R * (p.lng * Math.PI / 180) * Math.cos(lat0)
      const y = R * (p.lat * Math.PI / 180)
      return { x, y }
    })

    // Surface via formule de Shoelace
    let area = 0
    for (let i = 0; i < xy.length; i++) {
      const j = (i + 1) % xy.length
      area += xy[i].x * xy[j].y - xy[j].x * xy[i].y
    }
    area = Math.abs(area / 2)

    // Azimut : orientation du côté le plus long du polygone (proxy du rampant principal)
    let maxLen = 0
    let azimuthRad = 0
    for (let i = 0; i < xy.length; i++) {
      const j = (i + 1) % xy.length
      const dx = xy[j].x - xy[i].x
      const dy = xy[j].y - xy[i].y
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len > maxLen) {
        maxLen = len
        // Angle par rapport au nord (0° = nord, sens horaire)
        azimuthRad = Math.atan2(dx, dy)
      }
    }
    let azimuthDeg = (azimuthRad * 180 / Math.PI + 360) % 360
    // Normalise puis bascule vers l'orientation "face au soleil" (perpendiculaire au faîtage)
    azimuthDeg = (azimuthDeg + 90) % 360

    const centroid = points.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat / points.length, lng: acc.lng + p.lng / points.length }),
      { lat: 0, lng: 0 }
    )

    return {
      surface: Math.round(area),
      azimut: Math.round(azimuthDeg),
      lat: centroid.lat,
      lng: centroid.lng,
    }
  }

  function handleInclinaisonChange(v) {
    setInclinaison(v)
    if (polygonInfo) onResult?.({ ...polygonInfo, inclinaison: v })
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: '#6b7280', flex: 1 }}>
          {searching ? 'Localisation en cours…' : 'La carte se centre automatiquement sur l\u2019adresse renseignée.'}
        </div>
        <button
          type="button"
          onClick={handleManualLocate}
          disabled={searching || !searchAddress}
          style={{
            padding: '8px 14px', fontSize: 13, fontWeight: 600,
            background: '#0a1628', color: '#fff', border: 'none', borderRadius: 8,
            cursor: (searching || !searchAddress) ? 'not-allowed' : 'pointer',
            opacity: (searching || !searchAddress) ? 0.5 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          📍 Localiser
        </button>
      </div>
      {searchError && (
        <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 8 }}>⚠ {searchError}</div>
      )}

      <div
        ref={mapRef}
        style={{ width: '100%', height: 320, borderRadius: 10, overflow: 'hidden', border: '1px solid #d1d5db' }}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button
          type="button"
          onClick={() => setDrawing((d) => !d)}
          style={{
            flex: 1, padding: '10px 14px', fontSize: 13, fontWeight: 600,
            background: drawing ? '#FFB400' : '#f3f4f6',
            color: drawing ? '#0a1628' : '#374151',
            border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer',
          }}
        >
          {drawing ? '✏️ Mode dessin actif — cliquez les coins du toit' : '✏️ Tracer la toiture'}
        </button>
        <button
          type="button"
          onClick={resetPolygon}
          style={{
            padding: '10px 14px', fontSize: 13, fontWeight: 600,
            background: '#fef2f2', color: '#dc2626',
            border: '1px solid #fecaca', borderRadius: 8, cursor: 'pointer',
          }}
        >
          Effacer
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
          Inclinaison du toit (°) — estimation visuelle
        </label>
        <input
          type="range"
          min="0"
          max="60"
          value={inclinaison}
          onChange={(e) => handleInclinaisonChange(Number(e.target.value))}
          style={{ width: '100%' }}
        />
        <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'center' }}>{inclinaison}°</div>
      </div>

      {polygonInfo && (
        <div style={{
          marginTop: 12, background: '#f0fdf4', border: '1px solid #bbf0cf',
          borderRadius: 8, padding: 12, fontSize: 13,
        }}>
          <div style={{ fontWeight: 600, color: '#15803d', marginBottom: 4 }}>✓ Toiture tracée</div>
          <div style={{ color: '#374151' }}>
            Surface : <strong>{polygonInfo.surface} m²</strong> · Azimut : <strong>{polygonInfo.azimut}°</strong> · Inclinaison : <strong>{inclinaison}°</strong>
          </div>
        </div>
      )}

      {!polygonInfo && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#9ca3af' }}>
          Activez le mode dessin, puis cliquez sur au moins 3 coins du toit pour tracer son contour.
        </div>
      )}
    </div>
  )
}
