"use client";
import { useState } from "react";
import type { SceneKind } from "@/lib/domain/types";
import { Scene } from "./Scene";

/** Photography with an illustrated base layer; fades in when (and if) the photo loads. */
export function TripImage({
  scene,
  photoUrl,
  alt,
  className = "",
  priority = false,
}: {
  scene: SceneKind;
  photoUrl?: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  return (
    <div className={`relative overflow-hidden bg-sand ${className}`}>
      <Scene kind={scene} className="absolute inset-0 h-full w-full" />
      {photoUrl && state !== "failed" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          onLoad={() => setState("loaded")}
          onError={() => setState("failed")}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${state === "loaded" ? "opacity-100" : "opacity-0"}`}
        />
      )}
      {(!photoUrl || state === "failed") && <span className="sr-only">{alt}</span>}
    </div>
  );
}
