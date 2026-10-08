import { siDuckduckgo, siGoogle, siBrave, siWikipedia, siSemanticscholar } from "simple-icons";

export function ProviderIcon({ provider, className }: { provider: string; className?: string }) {
  const norm = provider.toLowerCase();
  if (norm === "serper") {
    return (
      <svg className={className} role="img" viewBox="0 0 24 24" width="16" height="16" style={{ fill: "currentColor", display: "inline-block", verticalAlign: "middle", marginRight: "6px" }} xmlns="http://www.w3.org/2000/svg">
        <path d={siGoogle.path} />
      </svg>
    );
  }
  if (norm === "tavily") {
    return (
      <svg className={className} role="img" viewBox="0 0 24 24" width="16" height="16" style={{ fill: "currentColor", display: "inline-block", verticalAlign: "middle", marginRight: "6px" }} xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L14.7 8.6L22 9.2L16.5 14L18.2 21.2L12 17.4L5.8 21.2L7.5 14L2 9.2L9.3 8.6L12 2Z" />
      </svg>
    );
  }
  if (norm === "crossref") {
    return (
      <svg className={className} role="img" viewBox="0 0 24 24" width="16" height="16" style={{ fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", display: "inline-block", verticalAlign: "middle", marginRight: "6px" }} xmlns="http://www.w3.org/2000/svg">
        <line x1="12" y1="4" x2="12" y2="20" />
        <line x1="4" y1="12" x2="20" y2="12" />
      </svg>
    );
  }
  if (norm === "openalex") {
    return (
      <svg className={className} role="img" viewBox="0 0 24 24" width="16" height="16" style={{ fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", display: "inline-block", verticalAlign: "middle", marginRight: "6px" }} xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    );
  }

  let icon;
  switch (norm) {
    case "duckduckgo": icon = siDuckduckgo; break;
    case "google": icon = siGoogle; break;
    case "brave": icon = siBrave; break;
    case "wikipedia": icon = siWikipedia; break;
    case "semantic scholar": icon = siSemanticscholar; break;
    default: return null;
  }
  return (
    <svg className={className} role="img" viewBox="0 0 24 24" width="16" height="16" style={{ fill: "currentColor", display: "inline-block", verticalAlign: "middle", marginRight: "6px" }} xmlns="http://www.w3.org/2000/svg">
      <path d={icon.path} />
    </svg>
  );
}
