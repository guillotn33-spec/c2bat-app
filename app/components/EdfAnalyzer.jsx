"use client";
import { useState, useRef } from "react";

const S = {
  root: { fontFamily: "Arial, sans-serif" },
  dropzone: (dragging, loading) => ({
    border: `2px dashed ${dragging ? "#f59e0b" : "#d1d5db"}`,
    borderRadius: 16,
    padding: "32px 20px",
    textAlign: "center",
    cursor: loading ? "default" : "pointer",
    background: dragging ? "#fffbeb" : "#f9fafb",
    transition: "border-color 0.2s, background 0.2s",
  }),
  icon: { fontSize: 40, marginBottom: 8 },
  dropText: { fontWeight: 700, color: "#374151", fontSize: 14, margin: "0 0 4px" },
  dropSub: { color: "#9ca3af", fontSize: 12 },
  spinner: { color: "#f59e0b", fontWeight: 700, fontSize: 14 },
  headerCard: {
    background: "#0f172a",
    borderRadius: 14,
    padding: "16px 20px",
    marginBottom: 12,
    color: "#fff",
  },
  headerName: { fontWeight: 900, fontSize: 16, margin: "0 0 2px" },
  headerSub: { color: "#94a3b8", fontSize: 12, margin: 0 },
  pdl: { color: "#fbbf24", fontSize: 11, marginTop: 6, fontWeight: 600 },
  infoCard: {
    background: "#eff6ff",
    border: "2px solid #bfdbfe",
    borderRadius: 14,
    padding: "14px 18px",
    marginBottom: 12,
  },
  infoLabel: { fontWeight: 700, fontSize: 11, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  infoRow: { display: "flex", justifyContent: "space-between", fontSize: 13, color: "#1e293b", marginBottom: 4 },
  infoVal: { fontWeight: 700 },
  kpiRow: { display: "flex", gap: 10, marginBottom: 12 },
  kpiCard: { flex: 1, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 10px", textAlign: "center" },
  kpiVal: { fontWeight: 900, fontSize: 20, color: "#0f172a", margin: "0 0 4px" },
  kpiLabel: { fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4 },
  changeBtn: {
    width: "100%", padding: "10px 0", border: "1px solid #e5e7eb",
    borderRadius: 10, background: "#fff", color: "#6b7280",
    fontSize: 12, cursor: "pointer", marginTop: 4,
  },
};

export default function EdfAnalyzer({ onResult }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  async function analyser(file) {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/analyser-edf", { method: "POST", body: fd });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      onResult?.(json);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) analyser(file);
  }

  function onFileChange(e) {
    analyser(e.target.files?.[0]);
  }

  function reset() {
    setData(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    onResult?.(null);
  }

  const prixKwh = data?.montantAnnuelEur && data?.consoAnnuelleKwh && data.consoAnnuelleKwh > 0
    ? (data.montantAnnuelEur / data.consoAnnuelleKwh).toFixed(4)
    : null;

  if (data) {
    return (
      <div style={S.root}>
        {/* En-tête client */}
        <div style={S.headerCard}>
          <p style={S.headerName}>{data.nomClient || "Client EDF"}</p>
          <p style={S.headerSub}>{data.adresse || "Adresse non détectée"}</p>
          {data.pdl && <p style={S.pdl}>PDL : {data.pdl}</p>}
        </div>

        {/* Infos abonnement */}
        <div style={S.infoCard}>
          <p style={S.infoLabel}>Abonnement</p>
          {[
            ["Offre", data.tarif || "—"],
            ["Puissance souscrite", data.puissanceSouscrite ? data.puissanceSouscrite + " kVA" : "—"],
            ["Option tarifaire", data.optionTarifaire || data.tarif || "—"],
          ].map(([k, v]) => (
            <div key={k} style={S.infoRow}>
              <span style={{ color: "#64748b" }}>{k}</span>
              <span style={S.infoVal}>{v}</span>
            </div>
          ))}
        </div>

        {/* KPI */}
        <div style={S.kpiRow}>
          <div style={S.kpiCard}>
            <p style={{ ...S.kpiVal, color: "#10b981" }}>
              {data.consoAnnuelleKwh ? data.consoAnnuelleKwh.toLocaleString("fr-FR") : "—"}
            </p>
            <p style={S.kpiLabel}>kWh / an</p>
          </div>
          <div style={S.kpiCard}>
            <p style={{ ...S.kpiVal, color: "#f97316" }}>
              {data.montantAnnuelEur ? data.montantAnnuelEur.toLocaleString("fr-FR") + " €" : "—"}
            </p>
            <p style={S.kpiLabel}>Facture / an</p>
          </div>
          <div style={S.kpiCard}>
            <p style={{ ...S.kpiVal, color: "#6366f1" }}>
              {prixKwh ? prixKwh + " €" : "—"}
            </p>
            <p style={S.kpiLabel}>Prix / kWh</p>
          </div>
        </div>

        <button style={S.changeBtn} onClick={reset}>Changer de relevé</button>
      </div>
    );
  }

  return (
    <div style={S.root}>
      <div
        style={S.dropzone(dragging, loading)}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !loading && inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".pdf,image/*" style={{ display: "none" }} onChange={onFileChange} disabled={loading} />
        {loading ? (
          <>
            <p style={{ fontSize: 36, margin: "0 0 8px" }}>⏳</p>
            <p style={S.spinner}>Analyse en cours...</p>
            <p style={{ color: "#9ca3af", fontSize: 11, marginTop: 4 }}>Claude lit votre relevé EDF</p>
          </>
        ) : (
          <>
            <p style={S.icon}>📄</p>
            <p style={S.dropText}>Glissez votre relevé EDF ici</p>
            <p style={S.dropSub}>ou cliquez pour sélectionner · PDF ou image acceptés</p>
          </>
        )}
      </div>
      {error && (
        <p style={{ color: "#ef4444", fontSize: 12, marginTop: 8, textAlign: "center" }}>
          Erreur : {error}
        </p>
      )}
    </div>
  );
}
