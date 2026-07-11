import Sidebar from "./sidebar";

export default function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-5 md:ml-64 md:px-8 md:pb-10 md:pt-8">
        <h1 className="mb-5 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{title}</h1>
        {children}
      </main>
    </div>
  );
}
