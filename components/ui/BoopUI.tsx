"use client";

import React from "react";

export const boop = {
  card: {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 14,
    padding: 14,
    background: "rgba(255,255,255,0.03)",
  } as React.CSSProperties,

  input: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.2)",
    color: "#fff",
    padding: "0 12px",
    outline: "none",
  } as React.CSSProperties,

  label: { opacity: 0.7, fontSize: 12 } as React.CSSProperties,
  value: { fontSize: 18, fontWeight: 900 } as React.CSSProperties,
  subtle: { opacity: 0.85, fontSize: 13 } as React.CSSProperties,
  mono: { marginTop: 10, opacity: 0.65, fontSize: 11 } as React.CSSProperties,
};

export function Card(props: { style?: React.CSSProperties; children: React.ReactNode }) {
  return <div style={{ ...boop.card, ...(props.style || {}) }}>{props.children}</div>;
}

export function Button(props: {
  children: React.ReactNode;
  onClick?: (e: any) => void;
  disabled?: boolean;
  variant?: "ghost" | "solid" | "danger" | "pill";
  style?: React.CSSProperties;
  type?: "button" | "submit";
}) {
  const v = props.variant || "solid";

  const base: React.CSSProperties = {
    height: 40,
    padding: "0 14px",
    borderRadius: v === "pill" ? 999 : 12,
    border: "1px solid rgba(255,255,255,0.18)",
    color: "#fff",
    cursor: props.disabled ? "not-allowed" : "pointer",
    fontWeight: 900,
    background: "rgba(255,255,255,0.06)",
    opacity: props.disabled ? 0.75 : 1,
  };

  const danger: React.CSSProperties = {
    background: "rgba(255, 77, 125, 0.80)",
  };

  const ghost: React.CSSProperties = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.12)",
    fontWeight: 800,
  };

  const pill: React.CSSProperties = {
    height: 32,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.04)",
    fontWeight: 900,
    fontSize: 12,
  };

  let style = { ...base };
  if (v === "danger") style = { ...style, ...danger };
  if (v === "ghost") style = { ...style, ...ghost };
  if (v === "pill") style = { ...pill };

  return (
    <button
      type={props.type || "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      style={{ ...style, ...(props.style || {}) }}
    >
      {props.children}
    </button>
  );
}

export function Badge(props: { text: string; kind: "active" | "pending" | "other" }) {
  const isActive = props.kind === "active";
  const style: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 900,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: isActive ? "rgba(96, 255, 160, 0.12)" : "rgba(255, 200, 90, 0.12)",
    color: isActive ? "rgba(170, 255, 210, 1)" : "rgba(255, 220, 160, 1)",
    letterSpacing: 0.6,
  };
  return <span style={style}>{props.text}</span>;
}

export function CountPill(props: { n: number }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 900,
        padding: "2px 8px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.10)",
        border: "1px solid rgba(255,255,255,0.14)",
        opacity: 0.9,
      }}
    >
      {props.n}
    </span>
  );
}
