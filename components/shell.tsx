import Sidebar from "./sidebar";

export default function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#EDF0E9]">
      <Sidebar />
      <main className="min-h-screen p-4 sm:p-6 lg:ml-72 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 rounded-3xl border border-[#DEE3D8] bg-white px-5 py-4 shadow-sm">
            <h1 className="text-2xl font-black tracking-tight text-[#123B2A] sm:text-3xl">{title}</h1>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
