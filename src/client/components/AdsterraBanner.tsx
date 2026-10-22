import type { AdsterraBannerProps } from "../types/AdsterraBanner.types";
export type { AdsterraBannerProps } from "../types/AdsterraBanner.types";
import { useEffect, useRef } from "react";

export function AdsterraBanner({ containerId, scriptSrc, className = "" }: AdsterraBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Check if script is already present
    const existingScript = document.querySelector(`script[src="${scriptSrc}"]`);
    if (!existingScript) {
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.src = scriptSrc;
      script.async = true;
      script.setAttribute("data-cfasync", "false");
      document.body.appendChild(script);
    }
  }, [scriptSrc]);

  return (
    <div className={`ad-container flex justify-center items-center overflow-hidden my-4 ${className}`}>
      <div id={containerId} ref={containerRef}></div>
    </div>
  );
}
