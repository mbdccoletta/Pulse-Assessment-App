import { ToastContainer } from "@dynatrace/strato-components/notifications";
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppHeader, HelpMenu, PageLayout } from "@dynatrace/strato-components/layouts";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PULSE_NAV, PulseCoverage } from "./kit/PulseCoverage";
import { DEFAULT_HOST } from "./kit/PulseHost";

// Pulse as its own app: the platform header plus the same PulseCoverage
// component another app mounts as its Coverage section (./kit).
export const App = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const go = (to: string) => (e: React.MouseEvent) => { e.preventDefault(); navigate(to); };

  return (
    <ErrorBoundary>
      <AppHeader>
        <AppHeader.Navigation>
          <AppHeader.Logo appName="Pulse Assessment" href="/" onClick={go("/")} />
          {PULSE_NAV.map(n => (
            <AppHeader.NavigationItem key={n.to} isSelected={n.match(pathname)} href={n.to} onClick={go(n.to)}>
              {n.label}
            </AppHeader.NavigationItem>
          ))}
        </AppHeader.Navigation>
        <AppHeader.ActionItems>
          {/* Refresh and Reports are portalled here on every page. */}
          <div id={DEFAULT_HOST.headerSlotId} style={{ display: "flex", alignItems: "center", gap: 8 }} />
        </AppHeader.ActionItems>
        <AppHeader.Menus>
          <HelpMenu entries={{
            documentation: { href: "https://docs.dynatrace.com/docs", target: "_blank" },
            about: "default",
          }} />
        </AppHeader.Menus>
      </AppHeader>
      <ToastContainer />
      <PageLayout>
        <PageLayout.Content>
          <PulseCoverage />
        </PageLayout.Content>
      </PageLayout>
    </ErrorBoundary>
  );
};
