export default function FinanzasPage() {
  return (
    <div className="max-w-7xl mx-auto mt-0 px-8 pt-4 pb-16">
      <div className="mb-8">
        <h1 className="font-body text-2xl font-black text-gray-900">Finanzas</h1>
        <p className="text-sm text-gray-500 mt-1">Métricas, ingresos y reportes</p>
      </div>

      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </div>
        <h2 className="font-body text-lg font-bold text-gray-900 mb-1">Próximamente</h2>
        <p className="text-sm text-gray-500 max-w-sm">
          Aquí podrás ver ingresos por comisiones, transacciones completadas y métricas de ventas.
        </p>
      </div>
    </div>
  )
}
