import Shell from "@/components/shell";
import RemittanceDetailClient from "@/components/remittance-detail-client";

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Shell title="Transaction Detail"><RemittanceDetailClient id={id} /></Shell>;
}
