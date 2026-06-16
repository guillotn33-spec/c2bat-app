/**
 * Géocodage via OpenStreetMap Nominatim
 * Retourne latitude, longitude, altitude (si dispo), adresse complete
 */
export async function geocodeAdresse(adresse, ville, codePostal) {
  const query = `${adresse} ${codePostal} ${ville} La Reunion France`;
  
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=fr&addressdetails=1`,
      { headers: { "Accept-Language": "fr" } }
    );
    const data = await res.json();
    
    if (!data || data.length === 0) return null;
    
    const result = data[0];
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    
    return {
      latitude: lat,
      longitude: lng,
      altitude: null,
      adresse_complete: result.display_name,
      google_maps_url: `https://www.google.com/maps?q=${lat},${lng}`,
    };
  } catch (err) {
    console.error("Geocodage erreur:", err);
    return null;
  }
}