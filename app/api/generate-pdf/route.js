import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { writeFile, unlink, readFile, mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'

// Chemin vers le script Python (à la racine du projet, dossier Scripts/)
const SCRIPT_PATH = path.join(process.cwd(), 'Scripts', 'generate_proposition_html.py')

// Commande Python :
// - En local (dev) : utilise le venv du projet (.venv)
// - En production (Railway) : utilise le venv créé dans nixpacks.toml (/opt/venv)
function getPythonCommand() {
  if (process.env.NODE_ENV === 'production') {
    return '/opt/venv/bin/python'
  }
  if (process.platform === 'win32') {
    return path.join(process.cwd(), '.venv', 'Scripts', 'python.exe')
  }
  return path.join(process.cwd(), '.venv', 'bin', 'python')
}

export async function POST(request) {
  let tmpDir

  try {
    const data = await request.json()

    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
    }

    // Dossier temporaire pour le JSON d'entrée et le PDF de sortie
    tmpDir = await mkdtemp(path.join(tmpdir(), 'c2bat-pdf-'))
    const inputPath = path.join(tmpDir, 'data.json')
    const outputPath = path.join(tmpDir, 'proposition.pdf')

    await writeFile(inputPath, JSON.stringify(data), 'utf-8')

    const pythonCmd = getPythonCommand()

    await new Promise((resolve, reject) => {
      const proc = spawn(pythonCmd, [SCRIPT_PATH, inputPath, outputPath], {
        cwd: process.cwd(),
      })

      let stderr = ''
      proc.stderr.on('data', (chunk) => { stderr += chunk.toString() })

      proc.on('error', (err) => {
        reject(new Error(`Impossible de lancer Python : ${err.message}`))
      })

      proc.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(stderr || `Le script Python a échoué (code ${code})`))
        }
      })
    })

    const pdfBuffer = await readFile(outputPath)

    const clientName = (data.client_nom || 'proposition')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="proposition_${clientName}.pdf"`,
      },
    })
  } catch (err) {
    console.error('Erreur génération PDF:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la génération du PDF', detail: err.message },
      { status: 500 }
    )
  } finally {
    // Nettoyage du dossier temporaire
    if (tmpDir) {
      try {
        await unlink(path.join(tmpDir, 'data.json')).catch(() => {})
        await unlink(path.join(tmpDir, 'proposition.pdf')).catch(() => {})
      } catch {
        // silencieux
      }
    }
  }
}
