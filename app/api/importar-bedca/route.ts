import { NextResponse } from 'next/server'
import { importBedca } from '@/scripts/import-bedca'

export async function GET() {
  try {
    const result = await importBedca()
    return NextResponse.json({
      message: `BEDCA importada: ${result.count} alimentos insertados`,
      ...result
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Error al importar BEDCA: ' + error.message },
      { status: 500 }
    )
  }
}
