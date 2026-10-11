"use client";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export default function InquiryStatus({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  return (
    <select aria-label="Enquiry status" className="field min-h-8 w-32 py-1 text-xs" value={status} onChange={async (e) => { await api.patch(`/portal/inquiries/${id}`, { status: e.target.value }); router.refresh(); }}>
      <option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option>
    </select>
  );
}
