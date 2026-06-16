import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return Response.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "application/octet-stream";

    const isImage = mimeType.startsWith("image/");
    const isPdf = mimeType === "application/pdf";

    if (!isImage && !isPdf) {
      return Response.json({ error: "Format non supporté. Envoyez un PDF ou une image." }, { status: 400 });
    }

    const fileContent = isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } };

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            fileContent,
            {
              type: "text",
              text: `Analyse ce relevé de consommation EDF et extrais les informations suivantes. Réponds UNIQUEMENT avec un objet JSON valide, sans texte supplémentaire, sans balises markdown :

{
  "nomClient": "nom complet du titulaire du contrat ou null",
  "adresse": "adresse du site de consommation ou null",
  "pdl": "numéro de point de livraison (PDL/PRM, 14 chiffres) ou null",
  "tarif": "offre ou abonnement souscrit (ex: Option Base, Option Heures Creuses, Tarif Bleu, Tarif Vert)",
  "optionTarifaire": "option tarifaire détaillée si différente du tarif ou null",
  "puissanceSouscrite": nombre en kVA ou null si non trouvé,
  "consoAnnuelleKwh": consommation totale annuelle en kWh (entier) ou null si non trouvé,
  "montantAnnuelEur": montant total annuel payé en euros (nombre) ou null si non trouvé
}`,
            },
          ],
        },
      ],
    });

    const text = message.content[0].text.trim();
    const jsonStr = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const data = JSON.parse(jsonStr);

    return Response.json(data);
  } catch (error) {
    console.error("Erreur analyse EDF:", error);
    return Response.json({ error: "Erreur lors de l'analyse : " + error.message }, { status: 500 });
  }
}
