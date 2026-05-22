import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/karte")({
  component: () => <Navigate to="/karten/region" replace />,
});
