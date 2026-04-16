import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export function PermissionRoute({ permission }: { permission: string }) {
  const { user } = useAuth();

  if (!user?.permissions.includes(permission)) {
    return <Navigate to="/settings" replace />;
  }

  return <Outlet />;
}
