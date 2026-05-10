/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert, Loader2, Eye, CheckCircle, XCircle } from "lucide-react";
import ZappButton from "@/components/ZappButton";

type KYCProfile = {
  id: string;
  user_id: string;
  full_name: string | null;
  username: string | null;
  phone_number: string | null;
  kyc_status: string;
  created_at: string;
};

export default function KYCTab() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("pending");
  const [viewingDocs, setViewingDocs] = useState<string | null>(null);
  const [docUrls, setDocUrls] = useState<string[]>([]);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectFor, setShowRejectFor] = useState<string | null>(null);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["admin-kyc-profiles", filter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_all_profiles");
      if (error) throw error;
      return (data as KYCProfile[]).filter((p) =>
        filter === "all" ? true : p.kyc_status === filter
      );
    },
  });

  const updateKYC = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      const API = import.meta.env.VITE_API_BASE_URL || "";
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`${API}/api/v1/admin/kyc/${userId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ status, reason: rejectReason }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "KYC update failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-kyc-profiles"] });
      setShowRejectFor(null);
      setRejectReason("");
      toast.success("KYC status updated");
    },
    onError: (err: unknown) => toast.error((err as Error).message),
  });

  const viewDocuments = async (userId: string) => {
    setViewingDocs(userId);
    setDocUrls([]);
    const { data, error } = await supabase.storage
      .from("kyc-documents")
      .list(userId, { limit: 20 });
    if (error || !data?.length) {
      setDocUrls([]);
      return;
    }
    const urlPromises = data.map(async (file) => {
      const { data: signedData, error: signedError } = await supabase.storage
        .from("kyc-documents")
        .createSignedUrl(`${userId}/${file.name}`, 300); // 5-minute expiry
      if (signedError || !signedData?.signedUrl) return null;
      return signedData.signedUrl;
    });
    const urls = (await Promise.all(urlPromises)).filter((u): u is string => u !== null);
    setDocUrls(urls);
  };

  const statusColors: Record<string, string> = {
    unverified: "bg-muted text-muted-foreground",
    pending: "bg-yellow-500/20 text-yellow-400",
    verified: "bg-accent/20 text-accent",
    rejected: "bg-destructive/20 text-destructive",
  };

  const filters = ["pending", "unverified", "verified", "rejected", "all"];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 h-9 rounded-lg text-sm font-semibold whitespace-nowrap transition-all capitalize ${
              filter === f ? "bg-primary text-primary-foreground" : "bg-foreground/5 text-muted-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : profiles.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <ShieldCheck size={32} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No {filter} verifications</p>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map((p) => (
            <div key={p.id} className="glass-card rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm">{p.full_name || "No name"}</p>
                  <p className="text-xs text-muted-foreground">@{p.username || "—"} · {p.phone_number || "No phone"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Joined {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${statusColors[p.kyc_status] || statusColors.unverified}`}>
                  {p.kyc_status}
                </span>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => viewDocuments(p.user_id)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-lg"
                >
                  <Eye size={13} /> View Docs
                </button>

                {p.kyc_status !== "verified" && (
                  <button
                    onClick={() => updateKYC.mutate({ userId: p.user_id, status: "verified" })}
                    className="flex items-center gap-1.5 text-xs font-semibold text-accent bg-accent/10 px-3 py-1.5 rounded-lg"
                  >
                    <CheckCircle size={13} /> Approve
                  </button>
                )}

                {p.kyc_status !== "rejected" && (
                  <button
                    onClick={() => setShowRejectFor(showRejectFor === p.user_id ? null : p.user_id)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-destructive bg-destructive/10 px-3 py-1.5 rounded-lg"
                  >
                    <XCircle size={13} /> Reject
                  </button>
                )}
              </div>

              {showRejectFor === p.user_id && (
                <div className="flex gap-2">
                  <input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Rejection reason (optional)"
                    className="flex-1 h-9 bg-foreground/5 rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                  <ZappButton
                    onClick={() => updateKYC.mutate({ userId: p.user_id, status: "rejected" })}
                    className="!h-9 !px-4"
                  >
                    Confirm
                  </ZappButton>
                </div>
              )}

              {viewingDocs === p.user_id && (
                <div className="bg-foreground/5 rounded-xl p-3">
                  {docUrls.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">No documents uploaded</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {docUrls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                          className="block rounded-lg overflow-hidden border border-foreground/10">
                          <img src={url} alt={`KYC doc ${i + 1}`} className="w-full h-32 object-cover" 
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          <p className="text-[10px] text-muted-foreground p-1.5 truncate">Document {i + 1}</p>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
