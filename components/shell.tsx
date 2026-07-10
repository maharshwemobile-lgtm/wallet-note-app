import Sidebar from "./sidebar";

export default function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return <div>
    <Sidebar/>
    <main className="min-h-screen p-4 sm:p-6 lg:ml-72 lg:p-8">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{title}</h1>
      {children}
    </main>
  </div>;
}
