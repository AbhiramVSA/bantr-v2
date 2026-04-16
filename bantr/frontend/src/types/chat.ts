export type ChatMessage = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

export type ChatContextDebate = {
  id: string;
  title: string;
};

export type ChatResponse = {
  message: ChatMessage;
  context_debates: ChatContextDebate[];
};
