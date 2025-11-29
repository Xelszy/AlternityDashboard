export interface Character {
  name: string;
  outfit: string;
}

export interface QCImage {
  id: number;
  file?: File;
  url: string;
  oldUrl?: string | null;
  name: string;
  prompt: string;
  originalPrompt: string;
  status: 'pending' | 'approved' | 'rejected';
  setting?: string;
}

export interface PromptEntry {
  outputAi: string; // Format: "Prompt text || Chap 1_1"
}

export interface ExtractionResult {
  images: PromptEntry[];
  backgrounds: any[];
  audio: any[];
}