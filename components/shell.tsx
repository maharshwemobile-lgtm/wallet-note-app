import Sidebar from "./sidebar";
export default function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><Sidebar/><main className="ml-72 min-h-screen p-8"><h1 className="mb-6 text-3xl font-bold">{title}</h1>{children}</main></div>;
}
