// src/ui/routes.tsx — route table (DP-UI §5.7).
// Requirement IDs: FR-19
import { Suspense, lazy } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { Shell } from "./shell/Shell.js";
import HomePage from "./pages/Home.js";
import WatchPage from "./pages/Watch.js";
import LabPage from "./pages/Lab.js";

const KitPage = lazy(() => import("./pages/Kit.js"));

export const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/watch", element: <WatchPage /> },
      { path: "/lab", element: <LabPage /> },
      {
        path: "/__kit",
        element: (
          <Suspense fallback={null}>
            <KitPage />
          </Suspense>
        ),
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
