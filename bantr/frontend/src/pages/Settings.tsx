import { Link } from "react-router-dom";
import { PageContainer } from "../components/layout/PageContainer";
import { Card } from "../components/ui/Card";
import { useAuth } from "../hooks/useAuth";

export function Settings() {
  const { user } = useAuth();
  const roleValue: unknown = user?.role;
  const roleLabel =
    typeof roleValue === "string"
      ? roleValue
      : roleValue && typeof roleValue === "object" && "name" in roleValue
        ? String(roleValue.name ?? "user")
        : "user";
  const permissions = Array.isArray(user?.permissions)
    ? user.permissions.filter((permission): permission is string => typeof permission === "string")
    : [];

  return (
    <PageContainer className="space-y-8">
      <div>
        <h1 className="text-5xl font-headline font-extrabold tracking-tight text-on-background">
          Settings
        </h1>
        <p className="mt-3 text-lg text-on-surface-variant">
          Profile details, account access, and Bantr permissions.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
        <Card className="p-8">
          <h2 className="text-2xl font-headline font-extrabold text-on-background">Profile</h2>
          <dl className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">Username</dt>
              <dd className="mt-2 text-lg font-bold text-on-background">{user?.username}</dd>
            </div>
            <div>
              <dt className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">Email</dt>
              <dd className="mt-2 text-lg text-on-surface">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">Role</dt>
              <dd className="mt-2 text-lg text-on-surface">{roleLabel}</dd>
            </div>
            <div>
              <dt className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">User ID</dt>
              <dd className="mt-2 break-all text-sm text-on-surface-variant">{user?.id}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-8">
          <h2 className="text-2xl font-headline font-extrabold text-on-background">Access</h2>
          <div className="mt-6 flex flex-wrap gap-3">
            {permissions.length ? (
              permissions.map((permission) => (
                <span
                  key={permission}
                  className="rounded-full bg-secondary-container px-4 py-2 text-sm font-bold text-on-secondary-container"
                >
                  {permission}
                </span>
              ))
            ) : (
              <p className="text-on-surface-variant">No elevated permissions assigned.</p>
            )}
          </div>

          {permissions.includes("users:read") ? (
            <div className="mt-8 rounded-2xl bg-surface-container-low p-5">
              <h3 className="font-headline text-lg font-extrabold text-on-background">Admin tools</h3>
              <p className="mt-2 text-sm text-on-surface-variant">
                This account can review Bantr users and access the admin directory.
              </p>
              <Link
                to="/admin/users"
                className="mt-4 inline-flex rounded-full bg-primary px-5 py-3 font-headline font-bold text-on-primary"
              >
                Open Admin Users
              </Link>
            </div>
          ) : null}
        </Card>
      </div>

      <Card className="p-8">
        <h2 className="text-2xl font-headline font-extrabold text-on-background">Plan</h2>
        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-2xl bg-primary p-6 text-on-primary">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-on-primary/70">
              Current Plan
            </div>
            <div className="mt-2 text-3xl font-headline font-extrabold">Demo Free Tier</div>
            <p className="mt-2 max-w-2xl text-on-primary/85">
              Upgrade flows are not monetized in this POC yet. This section is the intended destination for plan management.
            </p>
          </div>
          <div className="rounded-full bg-white px-5 py-3 font-headline font-bold text-primary">
            Upgrade Coming Soon
          </div>
        </div>
      </Card>
    </PageContainer>
  );
}
