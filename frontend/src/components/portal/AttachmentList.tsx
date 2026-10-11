"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api, errMsg } from "@/lib/client";
import { Notice } from "./ui";

export default function AttachmentList({ projectId, items, canEdit }: { projectId: string; items: { id: string; file_name: string; url: string; by_name: string | null }[]; canEdit: boolean }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErr("");
    try {
      await api.post(`/portal/projects/${projectId}/attachments`, { fileName: f.get("fileName"), url: f.get("url") });
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch (x) {
      setErr(errMsg(x));
    }
  }
  return (
    <div className="space-y-3">
      {items.length === 0 && <p className="text-sm text-steel-600">No attachments. Add links to drawings, load schedules or site photos stored in your document system.</p>}
      <ul className="divide-y divide-steel-100 text-sm">
        {items.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 py-2">
            <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-semibold text-navy-800 hover:text-ember-600"><Paperclip className="size-4" />{a.file_name}<ExternalLink className="size-3" /></a>
            <span className="text-xs text-steel-500">{a.by_name}</span>
            {canEdit && <button aria-label="Remove" onClick={async () => { await api.del(`/portal/projects/${projectId}/attachments/${a.id}`); router.refresh(); }}><Trash2 className="size-4 text-bad" /></button>}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form onSubmit={add} className="flex flex-wrap items-end gap-2">
          <div className="min-w-40 flex-1"><label className="label" htmlFor="att-name">Name</label><input id="att-name" name="fileName" required className="field" /></div>
          <div className="min-w-60 flex-[2]"><label className="label" htmlFor="att-url">https link</label><input id="att-url" name="url" type="url" required pattern="https://.*" className="field" /></div>
          <Button type="submit" variant="fabric" size="sm">Add link</Button>
        </form>
      )}
      {err && <Notice tone="bad">{err}</Notice>}
    </div>
  );
}
