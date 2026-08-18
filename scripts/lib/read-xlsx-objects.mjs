import { stat } from 'node:fs/promises'
import readXlsxFile from 'read-excel-file/node'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_ROWS = 5000
const MAX_COLUMNS = 250

export async function readFirstSheetObjects(filePath) {
  const file = await stat(filePath)
  if (!file.isFile() || file.size < 1 || file.size > MAX_FILE_BYTES) {
    throw new Error('El Excel debe ser un archivo de hasta 10 MB')
  }

  const matrix = await readXlsxFile(filePath)
  if (matrix.length < 1 || matrix.length > MAX_ROWS + 1) {
    throw new Error('El Excel no tiene encabezados o supera 5.000 filas')
  }

  const headers = matrix[0].map((value) => String(value ?? '').trim())
  if (
    headers.length < 1 ||
    headers.length > MAX_COLUMNS ||
    headers.some((header) => !header) ||
    new Set(headers).size !== headers.length
  ) {
    throw new Error('El Excel contiene encabezados vacíos, duplicados o excesivos')
  }

  return matrix.slice(1).map((row) =>
    Object.fromEntries(
      headers.map((header, index) => [header, row[index] ?? ''])
    )
  )
}
