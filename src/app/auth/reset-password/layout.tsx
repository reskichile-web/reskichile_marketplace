export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-white overflow-auto flex flex-col">
      <div className="flex-1 flex flex-col justify-center">
        {children}
      </div>
    </div>
  )
}
