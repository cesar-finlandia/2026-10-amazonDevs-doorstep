// src/ui/App.tsx — session and router (DP-UI WU-UI-04).
// Requirement IDs: FR-19
import { RouterProvider } from "react-router";
import { router } from "./routes.js";
import { SessionProvider } from "./state/SessionProvider.js";

export default function App(): React.JSX.Element {
  return (
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>
  );
}
