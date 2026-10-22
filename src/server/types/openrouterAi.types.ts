

export type OpenRouterMessage = {
  role: "system" | "user";
  content: string;
};

export type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
    metadata?: {
      raw?: string;
      provider_name?: string;
    };
  };
};
