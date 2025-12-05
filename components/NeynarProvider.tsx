"use client";

import { NeynarContextProvider, Theme } from "@neynar/react";
import "@neynar/react/dist/style.css";
import React from "react";

export function NeynarProvider({ children }: { children: React.ReactNode }) {
  return (
    <NeynarContextProvider
      settings={{
        clientId: process.env.NEXT_PUBLIC_NEYNAR_CLIENT_ID || "",
        defaultTheme: Theme.Dark,
        eventsCallbacks: {
          onAuthSuccess: () => {
            console.log("Neynar auth success");
          },
          onSignout: () => {
            console.log("Neynar signout");
          },
        },
      }}
    >
      {children}
    </NeynarContextProvider>
  );
}
