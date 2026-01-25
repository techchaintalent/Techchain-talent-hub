"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Textarea } from "@/components/ui/textarea";

interface Recruiter {
  id: string;
  status: string;
  fullName: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  location: string | null;
  experienceYears: number | null;
  specializations: string[];
  cryptoExperience: boolean;
  bio: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  _count: {
    submissions: number;
    commissions: number;
  };
}

export default function AdminRecruitersPage() {
  const { toast } = useToast();
  const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("PENDING_APPROVAL");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>(
    {}
  );

  const fetchRecruiters = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/recruiters?status=${statusFilter}&limit=50`
      );
      const data = await res.json();
      setRecruiters(data.recruiters || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch recruiters",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecruiters();
  }, [statusFilter]);

  const handleAction = async (
    recruiterId: string,
    action: "approve" | "reject"
  ) => {
    setActionLoading(recruiterId);
    try {
      const res = await fetch("/api/admin/recruiters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recruiterId,
          action,
          reason: rejectionReason[recruiterId],
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update recruiter");
      }

      toast({
        title: "Success",
        description: `Recruiter ${action === "approve" ? "approved" : "rejected"} successfully`,
      });

      fetchRecruiters();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update recruiter",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <Badge variant="success">Approved</Badge>;
      case "PENDING_APPROVAL":
        return <Badge variant="warning">Pending</Badge>;
      case "REJECTED":
        return <Badge variant="destructive">Rejected</Badge>;
      case "SUSPENDED":
        return <Badge variant="destructive">Suspended</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recruiter Management</h1>
          <p className="text-muted-foreground">
            Review and manage recruiter applications
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading...
        </div>
      ) : recruiters.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No recruiters found with this status
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {recruiters.map((recruiter) => (
            <Card key={recruiter.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {recruiter.fullName || recruiter.user.name || "Unknown"}
                      {getStatusBadge(recruiter.status)}
                    </CardTitle>
                    <CardDescription>{recruiter.user.email}</CardDescription>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <div>Applied: {new Date(recruiter.createdAt).toLocaleDateString()}</div>
                    <div>Submissions: {recruiter._count.submissions}</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Location:</span>
                    <p>{recruiter.location || "Not specified"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Experience:</span>
                    <p>
                      {recruiter.experienceYears
                        ? `${recruiter.experienceYears} years`
                        : "Not specified"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Crypto Experience:</span>
                    <p>{recruiter.cryptoExperience ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">LinkedIn:</span>
                    <p>
                      {recruiter.linkedinUrl ? (
                        <a
                          href={recruiter.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:underline"
                        >
                          View Profile
                        </a>
                      ) : (
                        "Not provided"
                      )}
                    </p>
                  </div>
                </div>

                {recruiter.specializations.length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground">
                      Specializations:
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {recruiter.specializations.map((s) => (
                        <Badge key={s} variant="outline">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {recruiter.bio && (
                  <div>
                    <span className="text-sm text-muted-foreground">Bio:</span>
                    <p className="text-sm mt-1">{recruiter.bio}</p>
                  </div>
                )}

                {recruiter.status === "PENDING_APPROVAL" && (
                  <div className="flex items-end gap-4 pt-4 border-t">
                    <div className="flex-1">
                      <Textarea
                        placeholder="Rejection reason (optional)"
                        value={rejectionReason[recruiter.id] || ""}
                        onChange={(e) =>
                          setRejectionReason((prev) => ({
                            ...prev,
                            [recruiter.id]: e.target.value,
                          }))
                        }
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        onClick={() => handleAction(recruiter.id, "reject")}
                        disabled={actionLoading === recruiter.id}
                      >
                        Reject
                      </Button>
                      <Button
                        onClick={() => handleAction(recruiter.id, "approve")}
                        disabled={actionLoading === recruiter.id}
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
