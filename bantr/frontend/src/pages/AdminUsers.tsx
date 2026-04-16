import { useCallback, useEffect, useState } from "react";
import { PageContainer } from "../components/layout/PageContainer";
import { Card } from "../components/ui/Card";
import { ErrorState } from "../components/ui/ErrorState";
import { Spinner } from "../components/ui/Spinner";
import { listUsers } from "../services/users";
import type { AdminUser } from "../types/user";
import { ApiError } from "../types/api";
import { formatDate } from "../utils/format";

export function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await listUsers();
      setUsers(response);
    } catch (issue) {
      setError(issue instanceof ApiError ? issue.message : "Unable to load admin users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  return (
    <PageContainer className="space-y-8">
      <div>
        <h1 className="text-5xl font-headline font-extrabold tracking-tight text-on-background">Admin Users</h1>
        <p className="mt-3 text-lg text-on-surface-variant">Permission-gated view backed by `GET /users`.</p>
      </div>

      {loading ? <Spinner /> : null}
      {error ? <ErrorState message={error} onRetry={loadUsers} /> : null}

      {!loading && !error ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-surface-container-low">
                <tr className="text-left text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">
                  <th className="px-6 py-4">Username</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-surface-container">
                    <td className="px-6 py-4 font-bold text-on-background">{user.username}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{user.email}</td>
                    <td className="px-6 py-4 text-on-surface">{user.role_name ?? "None"}</td>
                    <td className="px-6 py-4 text-on-surface">{user.is_active ? "Active" : "Inactive"}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{formatDate(user.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </PageContainer>
  );
}
