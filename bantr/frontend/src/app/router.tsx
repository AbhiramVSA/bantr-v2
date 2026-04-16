import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
import { MarketingLayout } from "../components/layout/MarketingLayout";
import { PermissionRoute } from "../components/layout/PermissionRoute";
import { ProtectedRoute } from "../components/layout/ProtectedRoute";
import { Analysis } from "../pages/Analysis";
import { Auth } from "../pages/Auth";
import { Chat } from "../pages/Chat";
import { CreateDebate } from "../pages/CreateDebate";
import { Dashboard } from "../pages/Dashboard";
import { DebateDetail } from "../pages/DebateDetail";
import { Landing } from "../pages/Landing";
import { MyDebates } from "../pages/MyDebates";
import { Notifications } from "../pages/Notifications";
import { Resources } from "../pages/Resources";
import { Settings } from "../pages/Settings";
import { Transcript } from "../pages/Transcript";
import { AdminUsers } from "../pages/AdminUsers";

export const router = createBrowserRouter([
  {
    element: <MarketingLayout />,
    children: [
      { path: "/", element: <Landing /> },
      { path: "/auth", element: <Auth /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/dashboard", element: <Dashboard /> },
          { path: "/debates", element: <MyDebates /> },
          { path: "/debates/:id", element: <DebateDetail /> },
          { path: "/create", element: <CreateDebate /> },
          { path: "/transcript/:id", element: <Transcript /> },
          { path: "/analysis/:id", element: <Analysis /> },
          { path: "/chat", element: <Chat /> },
          { path: "/notifications", element: <Notifications /> },
          { path: "/resources", element: <Resources /> },
          { path: "/settings", element: <Settings /> },
          {
            element: <PermissionRoute permission="users:read" />,
            children: [{ path: "/admin/users", element: <AdminUsers /> }],
          },
        ],
      },
    ],
  },
]);
