import Shell from "@/components/shell";
import SheetConnectionClient from "@/components/sheet-connection-client";

export default function Page() {
  return <Shell title="My Google Sheet"><SheetConnectionClient /></Shell>;
}
