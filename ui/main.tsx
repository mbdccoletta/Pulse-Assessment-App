import React from "react";
import ReactDOM from "react-dom/client";
import { AppRoot } from "@dynatrace/strato-components/core";
import { MemoryRouter } from "react-router-dom";
import { App } from "./app/App";

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <AppRoot>
    <MemoryRouter>
      <App />
    </MemoryRouter>
  </AppRoot>
);
