export type UserProfile = {
  id: string;
  email: string;
  username: string;
  role: string | null;
  permissions: string[];
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  email: string;
  username: string;
  password: string;
};
