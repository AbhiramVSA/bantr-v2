import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "../features/auth/AuthContext";
import { router } from "./router";

export function AppProviders() {
  return (
    <AuthProvider>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </AuthProvider>
  );
}
