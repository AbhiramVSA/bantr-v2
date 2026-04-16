import React from "react";
import ReactDOM from "react-dom/client";
import { setLogLevel } from "@livekit/components-core";
import "@livekit/components-styles";
import { AppProviders } from "./app/providers";
import "./index.css";

setLogLevel("warn", { liveKitClientLogLevel: "warn" });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <AppProviders />,
);
