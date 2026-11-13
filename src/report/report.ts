import { File, Paths } from 'expo-file-system'

import { stamp } from './format'

// Relatório do que a app fez, para enviar depois de um treino ou jogo.
// Fica num ficheiro de texto que sobrevive a a app fechar: cada sessão
// acrescenta ao fim. Nada aqui pode fechar a app, por isso tudo falha em silêncio.

const MAX_BYTES = 3_000_000
const FLUSH_MS = 2000

let pending: string[] = []
let timer: ReturnType<typeof setTimeout> | null = null

function file(): File {
  return new File(Paths.document, 'trackcam-relatorio.txt')
}

/** Escreve já no ficheiro o que está à espera. */
export function flushReport(): void {
  if (timer != null) {
    clearTimeout(timer)
    timer = null
  }
  if (pending.length === 0) return
  const text = pending.join('')
  pending = []
  try {
    const f = file()
    if (!f.exists) f.create()
    f.write(text, { append: true })
  } catch {
    // sem relatório, a app continua
  }
}

/**
 * Regista uma linha. `urgent` escreve logo no ficheiro: usa-se antes de algo
 * que pode fechar a app, para a linha não se perder.
 */
export function report(text: string, urgent = false): void {
  pending.push(`${stamp(new Date())} ${text}\n`)
  if (urgent) flushReport()
  else if (timer == null) timer = setTimeout(flushReport, FLUSH_MS)
}

/** Começa uma sessão. Se a anterior não escreveu "fim", a app fechou sozinha. */
export function startReport(version: string): void {
  try {
    const f = file()
    if (f.exists && f.size > MAX_BYTES) f.delete()
  } catch {
    // segue com o ficheiro que houver
  }
  report(`===== sessão iniciada em ${new Date().toISOString()} · TrackCam ${version} =====`, true)
}

/** O ficheiro do relatório, já com tudo escrito, para partilhar. */
export function reportFileUri(): string {
  flushReport()
  return file().uri
}
