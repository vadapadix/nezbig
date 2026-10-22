import type { SearchGateway } from "../../domain/analysis/ports/SearchGateway.js";
import { searchWebCandidatesDetailed, hydrateSearchCandidatesDetailed } from "./webSearch.js";
import { rerankCandidates } from "./rerankCandidates.js";
export class WebSearchGateway implements SearchGateway {
  search = searchWebCandidatesDetailed;
  hydrate = hydrateSearchCandidatesDetailed;
  rerank = rerankCandidates;
}
